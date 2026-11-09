// Package trials implements the Trading Dojo practice loop:
// a Trial replays a synthetic dataset; each Round lets members commit a
// sealed decision, review each other blind, then reveal what happened.
//
// Trial, Round, Decision and Review live in one package because they share
// one consistency boundary: commit/lock/reveal must lock the same rows in a
// fixed order (round -> trial -> room). See docs/architecture/ARCHITECTURE.md.
//
// This file is pure domain logic: no SQL, no HTTP. It is the easiest place
// to start reading and testing.
package trials

import (
	"strings"
	"time"
	"unicode/utf8"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/apperr"
)

// EngineVersion identifies the rules used to run a trial. Stored on every
// trial so a future rule change cannot silently reinterpret old sessions.
const EngineVersion = "dojo-engine-v1"

// Replay sizing for v0.1 (all in M1 candles).
const (
	DatasetCandles = 600 // total candles generated for a trial
	WarmupCandles  = 120 // visible before round 1 starts
	RoundBars      = 30  // candles revealed by each round
)

// TrialStatus is the lifecycle of a trial.
type TrialStatus string

const (
	TrialCreated  TrialStatus = "CREATED"  // dataset ready, warm-up visible, no round yet
	TrialRunning  TrialStatus = "RUNNING"  // rounds in progress
	TrialFinished TrialStatus = "FINISHED" // terminal: dataset exhausted
)

// RoundStatus is the round state machine:
//
//	DECISION_OPEN --lock--> REVIEW_BLIND --reveal--> REVEALED --complete--> COMPLETED
//
// COMPLETED is terminal. Only the room OWNER may trigger transitions.
type RoundStatus string

const (
	RoundDecisionOpen RoundStatus = "DECISION_OPEN" // members commit sealed decisions
	RoundReviewBlind  RoundStatus = "REVIEW_BLIND"  // locked; decisions visible; future still hidden
	RoundRevealed     RoundStatus = "REVEALED"      // clock advanced; outcome visible
	RoundCompleted    RoundStatus = "COMPLETED"     // terminal
)

// Action is an owner command on a round.
type Action string

const (
	ActionLock     Action = "lock"
	ActionReveal   Action = "reveal"
	ActionComplete Action = "complete"
)

var transitions = map[Action]struct{ from, to RoundStatus }{
	ActionLock:     {RoundDecisionOpen, RoundReviewBlind},
	ActionReveal:   {RoundReviewBlind, RoundRevealed},
	ActionComplete: {RoundRevealed, RoundCompleted},
}

// NextStatus decides what an action does from the current status:
//   - valid transition       -> (target, false, nil)
//   - already in the target  -> (target, true,  nil)  a repeated request is a no-op
//   - anything else          -> ErrInvalidTransition
func NextStatus(current RoundStatus, a Action) (next RoundStatus, alreadyDone bool, err error) {
	t, ok := transitions[a]
	if !ok {
		return "", false, ErrInvalidTransition
	}
	switch current {
	case t.from:
		return t.to, false, nil
	case t.to:
		return t.to, true, nil
	default:
		return "", false, ErrInvalidTransition
	}
}

// AcceptsDecisions reports whether new decisions may be committed.
func (s RoundStatus) AcceptsDecisions() bool { return s == RoundDecisionOpen }

// AcceptsReviews: reviews are only allowed while the future is still hidden,
// so every review is judged on decision-time information only (Pillar C).
func (s RoundStatus) AcceptsReviews() bool { return s == RoundReviewBlind }

// DecisionsUnsealed: other members' decisions become visible after lock.
func (s RoundStatus) DecisionsUnsealed() bool { return s != RoundDecisionOpen }

// OutcomeVisible: the price move after the decision is shown after reveal.
func (s RoundStatus) OutcomeVisible() bool { return s == RoundRevealed || s == RoundCompleted }

// Direction of a decision.
type Direction string

const (
	Long  Direction = "LONG"
	Short Direction = "SHORT"
	Wait  Direction = "WAIT"
)

func (d Direction) valid() bool { return d == Long || d == Short || d == Wait }

// Field limits match the column sizes in migrations/0004_trials.sql.
const (
	minThesisLen       = 10
	maxThesisLen       = 2000
	minInvalidationLen = 5
	maxInvalidationLen = 1000
	maxRiskNoteLen     = 500
	maxFeedbackLen     = 2000
	minConfidence      = 1
	maxConfidence      = 5
)

// DecisionInput is what a player submits. Note what is NOT here: user ID,
// clock, dataset, timestamps. The server fills those in.
type DecisionInput struct {
	Direction    Direction `json:"direction"`
	Thesis       string    `json:"thesis"`
	Invalidation string    `json:"invalidation"`
	Confidence   int       `json:"confidence"`
	RiskNote     string    `json:"risk_note"`
}

// Normalize trims whitespace and upper-cases the direction.
func (in *DecisionInput) Normalize() {
	in.Direction = Direction(strings.ToUpper(strings.TrimSpace(string(in.Direction))))
	in.Thesis = strings.TrimSpace(in.Thesis)
	in.Invalidation = strings.TrimSpace(in.Invalidation)
	in.RiskNote = strings.TrimSpace(in.RiskNote)
}

// Validate checks a normalized decision.
func (in DecisionInput) Validate() error {
	if !in.Direction.valid() {
		return ErrInvalidDirection
	}
	if n := utf8.RuneCountInString(in.Thesis); n < minThesisLen || n > maxThesisLen {
		return ErrInvalidThesis
	}
	inv := utf8.RuneCountInString(in.Invalidation)
	if inv > maxInvalidationLen {
		return ErrInvalidInvalidation
	}
	// A position without a stated invalidation is a hope, not a plan.
	if in.Direction != Wait && inv < minInvalidationLen {
		return ErrInvalidationRequired
	}
	if in.Confidence < minConfidence || in.Confidence > maxConfidence {
		return ErrInvalidConfidence
	}
	if utf8.RuneCountInString(in.RiskNote) > maxRiskNoteLen {
		return ErrInvalidRiskNote
	}
	return nil
}

// ReviewInput is a blind peer review checklist for one decision.
type ReviewInput struct {
	DecisionID          int64  `json:"decision_id"`
	ThesisClear         bool   `json:"thesis_clear"`
	InvalidationDefined bool   `json:"invalidation_defined"`
	RiskDefined         bool   `json:"risk_defined"`
	EvidenceBased       bool   `json:"evidence_based"`
	Feedback            string `json:"feedback"`
}

func (in *ReviewInput) Normalize() { in.Feedback = strings.TrimSpace(in.Feedback) }

func (in ReviewInput) Validate() error {
	if in.DecisionID <= 0 {
		return ErrDecisionNotFound
	}
	if utf8.RuneCountInString(in.Feedback) > maxFeedbackLen {
		return ErrInvalidFeedback
	}
	return nil
}

// Trial is the stored state of a practice session.
type Trial struct {
	ID                 int64       `json:"id"`
	RoomID             int64       `json:"room_id"`
	DatasetID          int64       `json:"dataset_id"`
	DatasetFingerprint string      `json:"dataset_fingerprint"`
	EngineVersion      string      `json:"engine_version"`
	Status             TrialStatus `json:"status"`
	ClockIndex         int         `json:"clock_index"`
	RoundBars          int         `json:"round_bars"`
	CreatedBy          int64       `json:"created_by"`
	CreatedAt          time.Time   `json:"created_at"`
	UpdatedAt          time.Time   `json:"updated_at"`
}

// Round is one decide -> review -> reveal cycle.
type Round struct {
	ID                 int64       `json:"id"`
	TrialID            int64       `json:"trial_id"`
	RoundNo            int         `json:"round_no"`
	Status             RoundStatus `json:"status"`
	DecisionClockIndex int         `json:"decision_clock_index"`
	RevealClockIndex   *int        `json:"reveal_clock_index"`
	OpenedAt           time.Time   `json:"opened_at"`
	LockedAt           *time.Time  `json:"locked_at"`
	RevealedAt         *time.Time  `json:"revealed_at"`
	CompletedAt        *time.Time  `json:"completed_at"`
}

// Decision is a committed, immutable decision.
type Decision struct {
	ID                 int64     `json:"id"`
	RoundID            int64     `json:"round_id"`
	UserID             int64     `json:"user_id"`
	AuthorName         string    `json:"author_name"`
	Direction          Direction `json:"direction"`
	Thesis             string    `json:"thesis"`
	Invalidation       string    `json:"invalidation"`
	Confidence         int       `json:"confidence"`
	RiskNote           string    `json:"risk_note"`
	DatasetFingerprint string    `json:"dataset_fingerprint"`
	KnownAtClockIndex  int       `json:"known_at_clock_index"`
	KnownAtCandleTime  time.Time `json:"known_at_candle_time"`
	CommittedAt        time.Time `json:"committed_at"`
}

// Review is a blind peer review.
type Review struct {
	ID                  int64     `json:"id"`
	RoundID             int64     `json:"round_id"`
	DecisionID          int64     `json:"decision_id"`
	ReviewerID          int64     `json:"reviewer_id"`
	ReviewerName        string    `json:"reviewer_name"`
	ThesisClear         bool      `json:"thesis_clear"`
	InvalidationDefined bool      `json:"invalidation_defined"`
	RiskDefined         bool      `json:"risk_defined"`
	EvidenceBased       bool      `json:"evidence_based"`
	Feedback            string    `json:"feedback"`
	CreatedAt           time.Time `json:"created_at"`
}

// RevealTarget computes the clock after revealing one round, never moving
// past the last candle and never moving backwards.
func RevealTarget(clock, roundBars, lastIndex int) int {
	return max(clock, min(clock+roundBars, lastIndex))
}

// HasDataForAnotherRound reports whether a new round can reveal a full window.
func HasDataForAnotherRound(clock, roundBars, lastIndex int) bool {
	return clock+roundBars <= lastIndex
}

// Business errors. Codes are part of the API contract (docs/api/API.md).
var (
	ErrTrialNotFound    = apperr.New(apperr.KindNotFound, "TRIAL_NOT_FOUND", "Trial not found")
	ErrRoundNotFound    = apperr.New(apperr.KindNotFound, "ROUND_NOT_FOUND", "Round not found")
	ErrDecisionNotFound = apperr.New(apperr.KindNotFound, "DECISION_NOT_FOUND", "Decision not found in this round")

	ErrActiveTrialExists = apperr.New(apperr.KindConflict, "ACTIVE_TRIAL_EXISTS",
		"This room already has an unfinished trial")
	ErrTrialFinished = apperr.New(apperr.KindConflict, "TRIAL_FINISHED", "This trial has finished")
	ErrRoundLocked   = apperr.New(apperr.KindConflict, "ROUND_ALREADY_LOCKED",
		"This round no longer accepts decisions")
	ErrDecisionExists = apperr.New(apperr.KindConflict, "DECISION_ALREADY_COMMITTED",
		"You already committed a decision for this round; committed decisions cannot be changed")
	ErrInvalidTransition = apperr.New(apperr.KindConflict, "INVALID_ROUND_TRANSITION",
		"This action is not allowed in the round's current state")
	ErrNoDecisions = apperr.New(apperr.KindUnprocessable, "NO_DECISIONS_TO_LOCK",
		"At least one member must commit a decision before the round can be locked")
	ErrReviewNotAllowed = apperr.New(apperr.KindConflict, "REVIEW_NOT_ALLOWED",
		"Reviews are only accepted while the round is in REVIEW_BLIND")
	ErrOwnDecisionReview = apperr.New(apperr.KindUnprocessable, "CANNOT_REVIEW_OWN_DECISION",
		"You cannot review your own decision")
	ErrReviewExists = apperr.New(apperr.KindConflict, "REVIEW_ALREADY_SUBMITTED",
		"You already reviewed this decision")

	ErrInvalidDirection     = apperr.New(apperr.KindInvalid, "INVALID_DIRECTION", "direction must be LONG, SHORT or WAIT")
	ErrInvalidThesis        = apperr.New(apperr.KindInvalid, "INVALID_THESIS", "thesis must be 10-2000 characters")
	ErrInvalidInvalidation  = apperr.New(apperr.KindInvalid, "INVALID_INVALIDATION", "invalidation must be at most 1000 characters")
	ErrInvalidationRequired = apperr.New(apperr.KindUnprocessable, "INVALIDATION_REQUIRED",
		"LONG and SHORT decisions need an invalidation (at least 5 characters)")
	ErrInvalidConfidence = apperr.New(apperr.KindInvalid, "INVALID_CONFIDENCE", "confidence must be an integer from 1 to 5")
	ErrInvalidRiskNote   = apperr.New(apperr.KindInvalid, "INVALID_RISK_NOTE", "risk_note must be at most 500 characters")
	ErrInvalidFeedback   = apperr.New(apperr.KindInvalid, "INVALID_FEEDBACK", "feedback must be at most 2000 characters")
)
