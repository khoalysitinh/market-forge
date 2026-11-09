package trials

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
)

// ---- trials ---------------------------------------------------------------

const trialColumns = `id, room_id, dataset_id, dataset_fingerprint, engine_version, status,
	clock_index, round_bars, created_by, created_at, updated_at`

func scanTrial(row interface{ Scan(...any) error }) (Trial, error) {
	var t Trial
	err := row.Scan(&t.ID, &t.RoomID, &t.DatasetID, &t.DatasetFingerprint, &t.EngineVersion, &t.Status,
		&t.ClockIndex, &t.RoundBars, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt)
	return t, err
}

func getTrial(ctx context.Context, q database.Querier, id int64) (Trial, error) {
	return getTrialQuery(ctx, q, "SELECT "+trialColumns+" FROM trials WHERE id = ?", id)
}

// lockTrial reads the trial with an exclusive row lock held until the
// transaction ends. Any other transaction trying to lock the same trial waits.
func lockTrial(ctx context.Context, tx *sql.Tx, id int64) (Trial, error) {
	return getTrialQuery(ctx, tx, "SELECT "+trialColumns+" FROM trials WHERE id = ? FOR UPDATE", id)
}

func getTrialQuery(ctx context.Context, q database.Querier, query string, id int64) (Trial, error) {
	t, err := scanTrial(q.QueryRowContext(ctx, query, id))
	if errors.Is(err, sql.ErrNoRows) {
		return Trial{}, ErrTrialNotFound
	}
	if err != nil {
		return Trial{}, fmt.Errorf("get trial: %w", err)
	}
	return t, nil
}

func activeTrialID(ctx context.Context, q database.Querier, roomID int64) (int64, bool, error) {
	var id int64
	err := q.QueryRowContext(ctx, "SELECT id FROM trials WHERE active_room_id = ?", roomID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, fmt.Errorf("find active trial: %w", err)
	}
	return id, true, nil
}

func insertTrial(ctx context.Context, tx *sql.Tx, t Trial) (int64, error) {
	res, err := tx.ExecContext(ctx, `INSERT INTO trials
		(room_id, dataset_id, dataset_fingerprint, engine_version, status, clock_index, round_bars,
		 created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.RoomID, t.DatasetID, t.DatasetFingerprint, t.EngineVersion, string(t.Status), t.ClockIndex,
		t.RoundBars, t.CreatedBy, t.CreatedAt, t.UpdatedAt)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func listTrialsForRoom(ctx context.Context, q database.Querier, roomID int64) ([]Trial, error) {
	rows, err := q.QueryContext(ctx, "SELECT "+trialColumns+" FROM trials WHERE room_id = ? ORDER BY id DESC", roomID)
	if err != nil {
		return nil, fmt.Errorf("list trials: %w", err)
	}
	defer rows.Close()
	out := []Trial{}
	for rows.Next() {
		t, err := scanTrial(rows)
		if err != nil {
			return nil, fmt.Errorf("scan trial: %w", err)
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// setTrialStatus changes status only if the trial is still in `from`.
func setTrialStatus(ctx context.Context, tx *sql.Tx, id int64, from, to TrialStatus, now time.Time) error {
	res, err := tx.ExecContext(ctx,
		"UPDATE trials SET status = ?, updated_at = ? WHERE id = ? AND status = ?", string(to), now, id, string(from))
	return expectOneRow(res, err, "set trial status")
}

// advanceClock moves the replay clock forward. The `clock_index < ?` guard
// makes it impossible for this statement to move the clock backwards.
func advanceClock(ctx context.Context, tx *sql.Tx, id int64, newClock int, now time.Time) error {
	res, err := tx.ExecContext(ctx,
		"UPDATE trials SET clock_index = ?, updated_at = ? WHERE id = ? AND clock_index < ?", newClock, now, id, newClock)
	return expectOneRow(res, err, "advance clock")
}

// ---- rounds ---------------------------------------------------------------

const roundColumns = `id, trial_id, round_no, status, decision_clock_index, reveal_clock_index,
	opened_at, locked_at, revealed_at, completed_at`

func scanRound(row interface{ Scan(...any) error }) (Round, error) {
	var r Round
	var reveal sql.NullInt64
	var locked, revealed, completed sql.NullTime
	err := row.Scan(&r.ID, &r.TrialID, &r.RoundNo, &r.Status, &r.DecisionClockIndex, &reveal,
		&r.OpenedAt, &locked, &revealed, &completed)
	if err != nil {
		return Round{}, err
	}
	if reveal.Valid {
		v := int(reveal.Int64)
		r.RevealClockIndex = &v
	}
	r.LockedAt = nullTimePtr(locked)
	r.RevealedAt = nullTimePtr(revealed)
	r.CompletedAt = nullTimePtr(completed)
	return r, nil
}

func getRound(ctx context.Context, q database.Querier, id int64) (Round, error) {
	return getRoundQuery(ctx, q, "SELECT "+roundColumns+" FROM rounds WHERE id = ?", id)
}

// lockRound reads a round with an exclusive row lock. Every write to a round
// (decision, review, transition) starts here, so they are serialised per round.
func lockRound(ctx context.Context, tx *sql.Tx, id int64) (Round, error) {
	return getRoundQuery(ctx, tx, "SELECT "+roundColumns+" FROM rounds WHERE id = ? FOR UPDATE", id)
}

func getRoundQuery(ctx context.Context, q database.Querier, query string, id int64) (Round, error) {
	r, err := scanRound(q.QueryRowContext(ctx, query, id))
	if errors.Is(err, sql.ErrNoRows) {
		return Round{}, ErrRoundNotFound
	}
	if err != nil {
		return Round{}, fmt.Errorf("get round: %w", err)
	}
	return r, nil
}

func listRounds(ctx context.Context, q database.Querier, trialID int64) ([]Round, error) {
	rows, err := q.QueryContext(ctx, "SELECT "+roundColumns+" FROM rounds WHERE trial_id = ? ORDER BY round_no", trialID)
	if err != nil {
		return nil, fmt.Errorf("list rounds: %w", err)
	}
	defer rows.Close()
	out := []Round{}
	for rows.Next() {
		r, err := scanRound(rows)
		if err != nil {
			return nil, fmt.Errorf("scan round: %w", err)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func insertRound(ctx context.Context, tx *sql.Tx, trialID int64, roundNo, clock int, now time.Time) (int64, error) {
	res, err := tx.ExecContext(ctx, `INSERT INTO rounds (trial_id, round_no, status, decision_clock_index, opened_at)
		VALUES (?, ?, ?, ?, ?)`, trialID, roundNo, string(RoundDecisionOpen), clock, now)
	if err != nil {
		return 0, fmt.Errorf("insert round: %w", err)
	}
	return res.LastInsertId()
}

// updateRoundStatus applies a transition. The `status = from` condition is a
// second guard next to the row lock: if the status already changed, zero rows
// match and we return an error instead of writing an invalid state.
func updateRoundStatus(ctx context.Context, tx *sql.Tx, id int64, from, to RoundStatus, now time.Time, revealClock *int) error {
	var column string
	switch to {
	case RoundReviewBlind:
		column = "locked_at"
	case RoundRevealed:
		column = "revealed_at"
	case RoundCompleted:
		column = "completed_at"
	default:
		return fmt.Errorf("unsupported round target status %s", to)
	}
	// column comes from the fixed switch above, never from user input.
	query := "UPDATE rounds SET status = ?, " + column + " = ?, reveal_clock_index = COALESCE(?, reveal_clock_index) WHERE id = ? AND status = ?"
	res, err := tx.ExecContext(ctx, query, string(to), now, revealClock, id, string(from))
	return expectOneRow(res, err, "update round status")
}

// ---- decisions ------------------------------------------------------------

const decisionSelect = `SELECT d.id, d.round_id, d.user_id, u.display_name, d.direction, d.thesis,
	COALESCE(d.invalidation, ''), d.confidence, COALESCE(d.risk_note, ''), d.dataset_fingerprint,
	d.known_at_clock_index, d.known_at_candle_time, d.committed_at
	FROM decisions d JOIN users u ON u.id = d.user_id `

func scanDecision(row interface{ Scan(...any) error }) (Decision, error) {
	var d Decision
	err := row.Scan(&d.ID, &d.RoundID, &d.UserID, &d.AuthorName, &d.Direction, &d.Thesis, &d.Invalidation,
		&d.Confidence, &d.RiskNote, &d.DatasetFingerprint, &d.KnownAtClockIndex, &d.KnownAtCandleTime, &d.CommittedAt)
	d.KnownAtCandleTime = d.KnownAtCandleTime.UTC()
	return d, err
}

// insertDecision is the ONLY write the application ever performs on the
// decisions table. There is no update or delete function by design.
func insertDecision(ctx context.Context, tx *sql.Tx, d Decision) (int64, error) {
	res, err := tx.ExecContext(ctx, `INSERT INTO decisions
		(round_id, user_id, direction, thesis, invalidation, confidence, risk_note,
		 dataset_fingerprint, known_at_clock_index, known_at_candle_time, committed_at)
		VALUES (?, ?, ?, ?, NULLIF(?, ''), ?, NULLIF(?, ''), ?, ?, ?, ?)`,
		d.RoundID, d.UserID, string(d.Direction), d.Thesis, d.Invalidation, d.Confidence, d.RiskNote,
		d.DatasetFingerprint, d.KnownAtClockIndex, d.KnownAtCandleTime, d.CommittedAt)
	if err != nil {
		return 0, err // caller maps duplicate key -> ErrDecisionExists
	}
	return res.LastInsertId()
}

func getDecision(ctx context.Context, q database.Querier, id int64) (Decision, error) {
	d, err := scanDecision(q.QueryRowContext(ctx, decisionSelect+"WHERE d.id = ?", id))
	if errors.Is(err, sql.ErrNoRows) {
		return Decision{}, ErrDecisionNotFound
	}
	if err != nil {
		return Decision{}, fmt.Errorf("get decision: %w", err)
	}
	return d, nil
}

func listDecisions(ctx context.Context, q database.Querier, roundID int64) ([]Decision, error) {
	rows, err := q.QueryContext(ctx, decisionSelect+"WHERE d.round_id = ? ORDER BY d.committed_at, d.id", roundID)
	if err != nil {
		return nil, fmt.Errorf("list decisions: %w", err)
	}
	defer rows.Close()
	out := []Decision{}
	for rows.Next() {
		d, err := scanDecision(rows)
		if err != nil {
			return nil, fmt.Errorf("scan decision: %w", err)
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func countDecisions(ctx context.Context, q database.Querier, roundID int64) (int, error) {
	var n int
	err := q.QueryRowContext(ctx, "SELECT COUNT(*) FROM decisions WHERE round_id = ?", roundID).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count decisions: %w", err)
	}
	return n, nil
}

// decisionAuthor returns the author of a decision inside a given round.
func decisionAuthor(ctx context.Context, q database.Querier, decisionID, roundID int64) (int64, error) {
	var userID int64
	err := q.QueryRowContext(ctx, "SELECT user_id FROM decisions WHERE id = ? AND round_id = ?", decisionID, roundID).Scan(&userID)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrDecisionNotFound
	}
	if err != nil {
		return 0, fmt.Errorf("get decision author: %w", err)
	}
	return userID, nil
}

// ---- reviews --------------------------------------------------------------

func insertReview(ctx context.Context, tx *sql.Tx, roundID, reviewerID int64, in ReviewInput, now time.Time) (int64, error) {
	res, err := tx.ExecContext(ctx, `INSERT INTO reviews
		(round_id, decision_id, reviewer_id, thesis_clear, invalidation_defined, risk_defined,
		 evidence_based, feedback, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), ?)`,
		roundID, in.DecisionID, reviewerID, in.ThesisClear, in.InvalidationDefined, in.RiskDefined,
		in.EvidenceBased, in.Feedback, now)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

const reviewSelect = `SELECT v.id, v.round_id, v.decision_id, v.reviewer_id, u.display_name,
	v.thesis_clear, v.invalidation_defined, v.risk_defined, v.evidence_based,
	COALESCE(v.feedback, ''), v.created_at
	FROM reviews v JOIN users u ON u.id = v.reviewer_id `

func scanReview(row interface{ Scan(...any) error }) (Review, error) {
	var v Review
	err := row.Scan(&v.ID, &v.RoundID, &v.DecisionID, &v.ReviewerID, &v.ReviewerName, &v.ThesisClear,
		&v.InvalidationDefined, &v.RiskDefined, &v.EvidenceBased, &v.Feedback, &v.CreatedAt)
	return v, err
}

func getReview(ctx context.Context, q database.Querier, id int64) (Review, error) {
	v, err := scanReview(q.QueryRowContext(ctx, reviewSelect+"WHERE v.id = ?", id))
	if err != nil {
		return Review{}, fmt.Errorf("get review: %w", err)
	}
	return v, nil
}

func listReviews(ctx context.Context, q database.Querier, roundID int64) ([]Review, error) {
	rows, err := q.QueryContext(ctx, reviewSelect+"WHERE v.round_id = ? ORDER BY v.created_at, v.id", roundID)
	if err != nil {
		return nil, fmt.Errorf("list reviews: %w", err)
	}
	defer rows.Close()
	out := []Review{}
	for rows.Next() {
		v, err := scanReview(rows)
		if err != nil {
			return nil, fmt.Errorf("scan review: %w", err)
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// ---- helpers --------------------------------------------------------------

func expectOneRow(res sql.Result, err error, what string) error {
	if err != nil {
		return fmt.Errorf("%s: %w", what, err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("%s: %w", what, err)
	}
	if n != 1 {
		return fmt.Errorf("%s: expected 1 row, got %d (concurrent change?)", what, n)
	}
	return nil
}

func nullTimePtr(t sql.NullTime) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time.UTC()
	return &v
}
