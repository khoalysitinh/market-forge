// Package rooms manages Dojo rooms and their members.
package rooms

import (
	"strings"
	"time"
	"unicode/utf8"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/apperr"
)

// Role of a user inside a room.
type Role string

const (
	RoleOwner  Role = "OWNER"
	RoleMember Role = "MEMBER"
)

// Room is a practice room.
type Room struct {
	ID         int64     `json:"id"`
	Name       string    `json:"name"`
	OwnerID    int64     `json:"owner_id"`
	InviteCode string    `json:"invite_code"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

// Member is a user's membership in a room.
type Member struct {
	UserID      int64     `json:"user_id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	Role        Role      `json:"role"`
	JoinedAt    time.Time `json:"joined_at"`
}

// Detail is a room together with its members and the caller's role.
type Detail struct {
	Room    Room     `json:"room"`
	MyRole  Role     `json:"my_role"`
	Members []Member `json:"members"`
}

const maxRoomNameLen = 80

var (
	// ErrRoomNotFound is also returned to non-members: outsiders cannot even
	// learn whether a room ID exists.
	ErrRoomNotFound = apperr.New(apperr.KindNotFound, "ROOM_NOT_FOUND", "Room not found")
	ErrInvalidName  = apperr.New(apperr.KindInvalid, "INVALID_ROOM_NAME", "Room name must be 1-80 characters")
	ErrInvalidCode  = apperr.New(apperr.KindNotFound, "INVITE_CODE_NOT_FOUND", "No room uses this invite code")
)

// CreateInput is the body of POST /rooms.
type CreateInput struct {
	Name string `json:"name"`
}

func (in *CreateInput) normalize() { in.Name = strings.TrimSpace(in.Name) }

func (in CreateInput) validate() error {
	if n := utf8.RuneCountInString(in.Name); n < 1 || n > maxRoomNameLen {
		return ErrInvalidName
	}
	return nil
}

// JoinInput is the body of POST /rooms/join.
type JoinInput struct {
	InviteCode string `json:"invite_code"`
}

// Invite codes avoid look-alike characters (0/O, 1/I/L). 31 symbols ^ 10
// characters ≈ 49 bits of randomness: not guessable by brute force over HTTP.
const (
	inviteAlphabet   = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
	inviteCodeLength = 10
)

func normalizeInviteCode(c string) string { return strings.ToUpper(strings.TrimSpace(c)) }
