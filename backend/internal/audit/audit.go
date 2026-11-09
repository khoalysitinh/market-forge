// Package audit records business events in an append-only table.
//
// Append takes a *sql.Tx on purpose: an event must be written in the same
// transaction as the state change it describes, so either both are stored or
// neither is. There is no Update or Delete function, and database triggers
// (migration 0006) reject UPDATE/DELETE on audit_events.
package audit

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
)

// Type is the event name stored in audit_events.event_type.
type Type string

const (
	RoomCreated       Type = "ROOM_CREATED"
	MemberJoined      Type = "MEMBER_JOINED"
	TrialCreated      Type = "TRIAL_CREATED"
	TrialStarted      Type = "TRIAL_STARTED"
	TrialFinished     Type = "TRIAL_FINISHED"
	RoundOpened       Type = "ROUND_OPENED"
	DecisionCommitted Type = "DECISION_COMMITTED"
	RoundLocked       Type = "ROUND_LOCKED"
	ReviewSubmitted   Type = "REVIEW_SUBMITTED"
	MarketRevealed    Type = "MARKET_REVEALED"
	RoundCompleted    Type = "ROUND_COMPLETED"
)

// NewEvent is what a service passes to Append.
type NewEvent struct {
	RoomID      int64
	Type        Type
	ActorID     int64
	SubjectType string
	SubjectID   int64
	Payload     any // marshalled to JSON; must not contain secrets or hidden data
}

// Event is a stored event.
type Event struct {
	ID          int64           `json:"id"`
	RoomID      int64           `json:"room_id"`
	Sequence    int64           `json:"sequence"`
	Type        Type            `json:"type"`
	ActorID     int64           `json:"actor_id"`
	SubjectType string          `json:"subject_type"`
	SubjectID   int64           `json:"subject_id"`
	Payload     json.RawMessage `json:"payload"`
	CreatedAt   time.Time       `json:"created_at"`
}

// Append writes one event with the next sequence number of its room.
//
// Incrementing rooms.last_event_seq takes a row lock on the room, so two
// transactions appending to the same room are serialised and can never get
// the same sequence. The UNIQUE (room_id, sequence) index is a backstop.
func Append(ctx context.Context, tx *sql.Tx, now time.Time, e NewEvent) error {
	payload, err := json.Marshal(e.Payload)
	if err != nil {
		return fmt.Errorf("marshal %s payload: %w", e.Type, err)
	}
	if e.Payload == nil {
		payload = []byte("{}")
	}

	res, err := tx.ExecContext(ctx,
		"UPDATE rooms SET last_event_seq = last_event_seq + 1 WHERE id = ?", e.RoomID)
	if err != nil {
		return fmt.Errorf("bump event sequence: %w", err)
	}
	if n, _ := res.RowsAffected(); n != 1 {
		return fmt.Errorf("append %s: room %d not found", e.Type, e.RoomID)
	}
	var seq int64
	if err := tx.QueryRowContext(ctx,
		"SELECT last_event_seq FROM rooms WHERE id = ?", e.RoomID).Scan(&seq); err != nil {
		return fmt.Errorf("read event sequence: %w", err)
	}

	_, err = tx.ExecContext(ctx, `INSERT INTO audit_events
		(room_id, sequence, event_type, actor_user_id, subject_type, subject_id, payload, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		e.RoomID, seq, string(e.Type), e.ActorID, e.SubjectType, e.SubjectID, string(payload), now)
	if err != nil {
		return fmt.Errorf("insert %s event: %w", e.Type, err)
	}
	return nil
}

// MaxListLimit caps how many events one request can read.
const MaxListLimit = 500

// ListForRoom returns events of a room with sequence > afterSeq, oldest first.
// Callers must check room membership before calling.
func ListForRoom(ctx context.Context, q database.Querier, roomID, afterSeq int64, limit int) ([]Event, error) {
	if limit <= 0 || limit > MaxListLimit {
		limit = MaxListLimit
	}
	rows, err := q.QueryContext(ctx, `SELECT id, room_id, sequence, event_type, actor_user_id,
			subject_type, subject_id, payload, created_at
		FROM audit_events
		WHERE room_id = ? AND sequence > ?
		ORDER BY sequence
		LIMIT ?`, roomID, afterSeq, limit)
	if err != nil {
		return nil, fmt.Errorf("list audit events: %w", err)
	}
	defer rows.Close()

	events := []Event{}
	for rows.Next() {
		var ev Event
		var payload string
		if err := rows.Scan(&ev.ID, &ev.RoomID, &ev.Sequence, &ev.Type, &ev.ActorID,
			&ev.SubjectType, &ev.SubjectID, &payload, &ev.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan audit event: %w", err)
		}
		ev.Payload = json.RawMessage(payload)
		events = append(events, ev)
	}
	return events, rows.Err()
}
