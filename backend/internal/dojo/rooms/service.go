package rooms

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/audit"
	"github.com/khoalysitinh/market-forge/backend/internal/idempotency"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/clock"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
)

// Service implements room use cases.
type Service struct {
	db  *sql.DB
	now clock.Func
}

func NewService(db *sql.DB, now clock.Func) *Service { return &Service{db: db, now: now} }

// Create makes a room owned by actorID and records ROOM_CREATED.
// With an Idempotency-Key, a retried request returns the same room.
func (s *Service) Create(ctx context.Context, actorID int64, in CreateInput, idemKey string) (Detail, bool, error) {
	in.normalize()
	if err := in.validate(); err != nil {
		return Detail{}, false, err
	}
	var roomID int64
	var replayed bool
	err := database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		now := s.now()
		var err error
		roomID, replayed, err = idempotency.Run(ctx, tx, now, actorID, "room.create", idemKey, in,
			func() (int64, error) {
				id, err := insertRoomWithUniqueCode(ctx, tx, in.Name, actorID, now)
				if err != nil {
					return 0, err
				}
				if err := insertMember(ctx, tx, id, actorID, RoleOwner, now); err != nil {
					return 0, fmt.Errorf("insert owner membership: %w", err)
				}
				// The invite code is a room secret, so it is not in the payload.
				return id, audit.Append(ctx, tx, now, audit.NewEvent{
					RoomID: id, Type: audit.RoomCreated, ActorID: actorID,
					SubjectType: "ROOM", SubjectID: id, Payload: map[string]any{"name": in.Name},
				})
			})
		return err
	})
	if err != nil {
		return Detail{}, false, err
	}
	d, err := s.Get(ctx, actorID, roomID)
	return d, replayed, err
}

// insertRoomWithUniqueCode retries on the (very unlikely) invite-code clash.
// A duplicate-key error only rolls back that one INSERT statement in InnoDB,
// so the surrounding transaction stays usable for the next attempt.
func insertRoomWithUniqueCode(ctx context.Context, tx *sql.Tx, name string, ownerID int64, now time.Time) (int64, error) {
	const attempts = 5
	for i := 0; i < attempts; i++ {
		code, err := newInviteCode()
		if err != nil {
			return 0, err
		}
		id, err := insertRoom(ctx, tx, name, ownerID, code, now)
		if database.IsDuplicateKey(err) {
			continue
		}
		if err != nil {
			return 0, fmt.Errorf("insert room: %w", err)
		}
		return id, nil
	}
	return 0, errors.New("could not generate a unique invite code")
}

// Join adds the actor to the room with the given invite code. Joining a room
// you already belong to is a no-op (joined=false), so retries are safe.
func (s *Service) Join(ctx context.Context, actorID int64, in JoinInput) (Detail, bool, error) {
	code := normalizeInviteCode(in.InviteCode)
	if len(code) != inviteCodeLength {
		return Detail{}, false, ErrInvalidCode
	}
	var roomID int64
	joined := false
	err := database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		joined = false
		room, err := getRoomByInviteCode(ctx, tx, code)
		if err != nil {
			return err
		}
		roomID = room.ID
		now := s.now()
		err = insertMember(ctx, tx, room.ID, actorID, RoleMember, now)
		if database.IsDuplicateKey(err) {
			return nil // already a member
		}
		if err != nil {
			return fmt.Errorf("insert membership: %w", err)
		}
		joined = true
		return audit.Append(ctx, tx, now, audit.NewEvent{
			RoomID: room.ID, Type: audit.MemberJoined, ActorID: actorID,
			SubjectType: "ROOM", SubjectID: room.ID, Payload: map[string]any{"user_id": actorID},
		})
	})
	if err != nil {
		return Detail{}, false, err
	}
	d, err := s.Get(ctx, actorID, roomID)
	return d, joined, err
}

// List returns the rooms the actor belongs to.
func (s *Service) List(ctx context.Context, actorID int64) ([]Room, error) {
	return listRoomsForUser(ctx, s.db, actorID)
}

// Get returns a room with its members. Non-members get ErrRoomNotFound.
func (s *Service) Get(ctx context.Context, actorID, roomID int64) (Detail, error) {
	role, err := MemberRole(ctx, s.db, roomID, actorID)
	if err != nil {
		return Detail{}, err
	}
	room, err := getRoom(ctx, s.db, roomID)
	if err != nil {
		return Detail{}, err
	}
	members, err := ListMembers(ctx, s.db, roomID)
	if err != nil {
		return Detail{}, err
	}
	return Detail{Room: room, MyRole: role, Members: members}, nil
}

// Events returns the room's audit timeline. Members only.
func (s *Service) Events(ctx context.Context, actorID, roomID, afterSeq int64, limit int) ([]audit.Event, error) {
	if _, err := MemberRole(ctx, s.db, roomID, actorID); err != nil {
		return nil, err
	}
	return audit.ListForRoom(ctx, s.db, roomID, afterSeq, limit)
}

func newInviteCode() (string, error) {
	// Rejection sampling: only accept bytes below the largest multiple of
	// len(alphabet), so every symbol is equally likely (no modulo bias).
	n := len(inviteAlphabet)
	limit := 256 - (256 % n)
	out := make([]byte, 0, inviteCodeLength)
	buf := make([]byte, 1)
	for len(out) < inviteCodeLength {
		if _, err := rand.Read(buf); err != nil {
			return "", fmt.Errorf("generate invite code: %w", err)
		}
		if int(buf[0]) >= limit {
			continue
		}
		out = append(out, inviteAlphabet[int(buf[0])%n])
	}
	return string(out), nil
}
