package rooms

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
)

func insertRoom(ctx context.Context, q database.Querier, name string, ownerID int64, code string, now time.Time) (int64, error) {
	res, err := q.ExecContext(ctx,
		"INSERT INTO rooms (name, owner_id, invite_code, status, created_at) VALUES (?, ?, ?, 'ACTIVE', ?)",
		name, ownerID, code, now)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func insertMember(ctx context.Context, q database.Querier, roomID, userID int64, role Role, now time.Time) error {
	_, err := q.ExecContext(ctx,
		"INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
		roomID, userID, string(role), now)
	return err
}

const roomColumns = "r.id, r.name, r.owner_id, r.invite_code, r.status, r.created_at"

func scanRoom(row interface{ Scan(...any) error }) (Room, error) {
	var r Room
	err := row.Scan(&r.ID, &r.Name, &r.OwnerID, &r.InviteCode, &r.Status, &r.CreatedAt)
	return r, err
}

func getRoom(ctx context.Context, q database.Querier, id int64) (Room, error) {
	r, err := scanRoom(q.QueryRowContext(ctx, "SELECT "+roomColumns+" FROM rooms r WHERE r.id = ?", id))
	if errors.Is(err, sql.ErrNoRows) {
		return Room{}, ErrRoomNotFound
	}
	if err != nil {
		return Room{}, fmt.Errorf("get room: %w", err)
	}
	return r, nil
}

func getRoomByInviteCode(ctx context.Context, q database.Querier, code string) (Room, error) {
	r, err := scanRoom(q.QueryRowContext(ctx, "SELECT "+roomColumns+" FROM rooms r WHERE r.invite_code = ?", code))
	if errors.Is(err, sql.ErrNoRows) {
		return Room{}, ErrInvalidCode
	}
	if err != nil {
		return Room{}, fmt.Errorf("get room by invite code: %w", err)
	}
	return r, nil
}

// listRoomsForUser returns the rooms the user belongs to, newest first.
func listRoomsForUser(ctx context.Context, q database.Querier, userID int64) ([]Room, error) {
	rows, err := q.QueryContext(ctx, "SELECT "+roomColumns+` FROM rooms r
		JOIN room_members m ON m.room_id = r.id
		WHERE m.user_id = ?
		ORDER BY r.created_at DESC, r.id DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("list rooms: %w", err)
	}
	defer rows.Close()
	out := []Room{}
	for rows.Next() {
		r, err := scanRoom(rows)
		if err != nil {
			return nil, fmt.Errorf("scan room: %w", err)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// ListMembers returns all members of a room, oldest first. Callers must
// check membership first.
func ListMembers(ctx context.Context, q database.Querier, roomID int64) ([]Member, error) {
	rows, err := q.QueryContext(ctx, `SELECT m.user_id, u.username, u.display_name, m.role, m.joined_at
		FROM room_members m JOIN users u ON u.id = m.user_id
		WHERE m.room_id = ?
		ORDER BY m.joined_at, m.user_id`, roomID)
	if err != nil {
		return nil, fmt.Errorf("list members: %w", err)
	}
	defer rows.Close()
	out := []Member{}
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.UserID, &m.Username, &m.DisplayName, &m.Role, &m.JoinedAt); err != nil {
			return nil, fmt.Errorf("scan member: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// MemberRole returns the user's role in a room, or ErrRoomNotFound when the
// user is not a member (or the room does not exist). Other modules call
// this — with their transaction as q — before touching room data.
func MemberRole(ctx context.Context, q database.Querier, roomID, userID int64) (Role, error) {
	var role Role
	err := q.QueryRowContext(ctx,
		"SELECT role FROM room_members WHERE room_id = ? AND user_id = ?", roomID, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrRoomNotFound
	}
	if err != nil {
		return "", fmt.Errorf("get member role: %w", err)
	}
	return role, nil
}
