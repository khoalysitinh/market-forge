package trials

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/binary"
	"fmt"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/audit"
	"github.com/khoalysitinh/market-forge/backend/internal/dojo/rooms"
	"github.com/khoalysitinh/market-forge/backend/internal/idempotency"
	"github.com/khoalysitinh/market-forge/backend/internal/marketdata"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/apperr"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/clock"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
)

// SeedFunc returns the secret seed for a new synthetic dataset.
type SeedFunc func() (uint64, error)

// CryptoSeed draws a seed from the OS CSPRNG, so nobody — not even the
// room owner — can predict the dataset's future candles.
func CryptoSeed() (uint64, error) {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return 0, fmt.Errorf("generate dataset seed: %w", err)
	}
	return binary.BigEndian.Uint64(b[:]) >> 1, nil // 63 bits: fits a signed BIGINT too
}

// datasetStart is the (fictional) UTC time of candle 0 for every v0.1 dataset.
var datasetStart = time.Date(2000, time.January, 3, 14, 30, 0, 0, time.UTC)

// Service implements trial, round, decision and review use cases.
//
// Locking order, used by every transaction to avoid deadlocks:
//
//	idempotency key -> round -> trial -> room (via audit.Append)
type Service struct {
	db   *sql.DB
	now  clock.Func
	seed SeedFunc
}

func NewService(db *sql.DB, now clock.Func, seed SeedFunc) *Service {
	return &Service{db: db, now: now, seed: seed}
}

// requireOwner returns ErrRoomNotFound for outsiders and ErrOwnerOnly for
// members who are not the owner.
func requireOwner(ctx context.Context, q database.Querier, roomID, userID int64) error {
	role, err := rooms.MemberRole(ctx, q, roomID, userID)
	if err != nil {
		return err
	}
	if role != rooms.RoleOwner {
		return apperr.ErrOwnerOnly
	}
	return nil
}

// CreateTrial generates a fresh synthetic dataset and a trial in CREATED
// state for the room. OWNER only. At most one unfinished trial per room.
func (s *Service) CreateTrial(ctx context.Context, actorID, roomID int64, idemKey string) (TrialView, bool, error) {
	var trialID int64
	var replayed bool
	err := database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		now := s.now()
		var err error
		request := struct{ RoomID int64 }{roomID}
		trialID, replayed, err = idempotency.Run(ctx, tx, now, actorID, "trial.create", idemKey, request,
			func() (int64, error) {
				if err := requireOwner(ctx, tx, roomID, actorID); err != nil {
					return 0, err
				}
				// Fast, friendly check. The UNIQUE index below is the real guard.
				if _, exists, err := activeTrialID(ctx, tx, roomID); err != nil {
					return 0, err
				} else if exists {
					return 0, ErrActiveTrialExists
				}
				seed, err := s.seed()
				if err != nil {
					return 0, err
				}
				ds, err := marketdata.GenerateAndStore(ctx, tx,
					marketdata.DefaultParams(seed, datasetStart, DatasetCandles), now)
				if err != nil {
					return 0, err
				}
				id, err := insertTrial(ctx, tx, Trial{
					RoomID: roomID, DatasetID: ds.ID, DatasetFingerprint: ds.Fingerprint,
					EngineVersion: EngineVersion, Status: TrialCreated,
					ClockIndex: WarmupCandles - 1, RoundBars: RoundBars,
					CreatedBy: actorID, CreatedAt: now, UpdatedAt: now,
				})
				if database.IsDuplicateKey(err) {
					return 0, ErrActiveTrialExists // lost a race with another create
				}
				if err != nil {
					return 0, fmt.Errorf("insert trial: %w", err)
				}
				return id, audit.Append(ctx, tx, now, audit.NewEvent{
					RoomID: roomID, Type: audit.TrialCreated, ActorID: actorID, SubjectType: "TRIAL", SubjectID: id,
					Payload: map[string]any{"dataset_fingerprint": ds.Fingerprint, "engine_version": EngineVersion,
						"clock_index": WarmupCandles - 1},
				})
			})
		return err
	})
	if err != nil {
		return TrialView{}, false, err
	}
	v, err := s.GetTrial(ctx, actorID, trialID)
	return v, replayed, err
}

// StartTrial moves CREATED -> RUNNING and opens round 1. OWNER only.
// Starting an already running trial is a no-op.
func (s *Service) StartTrial(ctx context.Context, actorID, trialID int64) (TrialView, error) {
	err := database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		t, err := lockTrial(ctx, tx, trialID)
		if err != nil {
			return err
		}
		if err := requireOwner(ctx, tx, t.RoomID, actorID); err != nil {
			return hideOutsider(err, ErrTrialNotFound)
		}
		switch t.Status {
		case TrialRunning:
			return nil
		case TrialFinished:
			return ErrTrialFinished
		}
		now := s.now()
		if err := setTrialStatus(ctx, tx, t.ID, TrialCreated, TrialRunning, now); err != nil {
			return err
		}
		if err := audit.Append(ctx, tx, now, audit.NewEvent{RoomID: t.RoomID, Type: audit.TrialStarted,
			ActorID: actorID, SubjectType: "TRIAL", SubjectID: t.ID}); err != nil {
			return err
		}
		return s.openRound(ctx, tx, t, 1, actorID, now)
	})
	if err != nil {
		return TrialView{}, err
	}
	return s.GetTrial(ctx, actorID, trialID)
}

func (s *Service) openRound(ctx context.Context, tx *sql.Tx, t Trial, roundNo int, actorID int64, now time.Time) error {
	id, err := insertRound(ctx, tx, t.ID, roundNo, t.ClockIndex, now)
	if err != nil {
		return err
	}
	return audit.Append(ctx, tx, now, audit.NewEvent{RoomID: t.RoomID, Type: audit.RoundOpened,
		ActorID: actorID, SubjectType: "ROUND", SubjectID: id,
		Payload: map[string]any{"trial_id": t.ID, "round_no": roundNo, "decision_clock_index": t.ClockIndex}})
}

// CommitDecision stores the actor's sealed decision for a round.
// Invariants enforced here:
//   - only room members, only while DECISION_OPEN (row lock on the round
//     means lock/commit cannot interleave);
//   - one decision per user per round (UNIQUE index, survives any race);
//   - clock and dataset fingerprint are copied by the server.
func (s *Service) CommitDecision(ctx context.Context, actorID, roundID int64, in DecisionInput, idemKey string) (Decision, bool, error) {
	in.Normalize()
	if err := in.Validate(); err != nil {
		return Decision{}, false, err
	}
	var decisionID int64
	var replayed bool
	err := database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		now := s.now()
		var err error
		request := struct {
			RoundID int64
			Input   DecisionInput
		}{roundID, in}
		decisionID, replayed, err = idempotency.Run(ctx, tx, now, actorID, "decision.commit", idemKey, request,
			func() (int64, error) {
				r, err := lockRound(ctx, tx, roundID)
				if err != nil {
					return 0, err
				}
				t, err := getTrial(ctx, tx, r.TrialID)
				if err != nil {
					return 0, err
				}
				if _, err := rooms.MemberRole(ctx, tx, t.RoomID, actorID); err != nil {
					return 0, hideOutsider(err, ErrRoundNotFound)
				}
				if !r.Status.AcceptsDecisions() {
					return 0, ErrRoundLocked
				}
				known, err := marketdata.ListCandlesUpTo(ctx, tx, t.DatasetID, r.DecisionClockIndex, r.DecisionClockIndex)
				if err != nil {
					return 0, err
				}
				if len(known) != 1 {
					return 0, fmt.Errorf("candle %d missing for dataset %d", r.DecisionClockIndex, t.DatasetID)
				}
				id, err := insertDecision(ctx, tx, Decision{
					RoundID: r.ID, UserID: actorID, Direction: in.Direction, Thesis: in.Thesis,
					Invalidation: in.Invalidation, Confidence: in.Confidence, RiskNote: in.RiskNote,
					DatasetFingerprint: t.DatasetFingerprint, KnownAtClockIndex: r.DecisionClockIndex,
					KnownAtCandleTime: known[0].OpenTime, CommittedAt: now,
				})
				if database.IsDuplicateKey(err) {
					return 0, ErrDecisionExists
				}
				if err != nil {
					return 0, fmt.Errorf("insert decision: %w", err)
				}
				// The payload must NOT include direction or thesis: the event
				// timeline is visible to everyone while the round is still sealed.
				return id, audit.Append(ctx, tx, now, audit.NewEvent{RoomID: t.RoomID, Type: audit.DecisionCommitted,
					ActorID: actorID, SubjectType: "DECISION", SubjectID: id,
					Payload: map[string]any{"round_id": r.ID}})
			})
		return err
	})
	if err != nil {
		return Decision{}, false, err
	}
	d, err := getDecision(ctx, s.db, decisionID)
	return d, replayed, err
}

// Transition applies an owner action (lock, reveal, complete) to a round.
// A repeated action whose target state is already reached returns the
// current state without writing anything.
func (s *Service) Transition(ctx context.Context, actorID, roundID int64, action Action) (RoundView, error) {
	err := database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		r, err := lockRound(ctx, tx, roundID)
		if err != nil {
			return err
		}
		t, err := getTrial(ctx, tx, r.TrialID)
		if err != nil {
			return err
		}
		if err := requireOwner(ctx, tx, t.RoomID, actorID); err != nil {
			return hideOutsider(err, ErrRoundNotFound)
		}
		next, alreadyDone, err := NextStatus(r.Status, action)
		if err != nil || alreadyDone {
			return err
		}
		now := s.now()
		switch action {
		case ActionLock:
			return s.lock(ctx, tx, r, t, actorID, now)
		case ActionReveal:
			return s.reveal(ctx, tx, r, actorID, now)
		case ActionComplete:
			return s.complete(ctx, tx, r, actorID, now)
		default:
			return fmt.Errorf("unhandled action %s -> %s", action, next)
		}
	})
	if err != nil {
		return RoundView{}, err
	}
	return s.GetRound(ctx, actorID, roundID)
}

func (s *Service) lock(ctx context.Context, tx *sql.Tx, r Round, t Trial, actorID int64, now time.Time) error {
	n, err := countDecisions(ctx, tx, r.ID)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNoDecisions
	}
	if err := updateRoundStatus(ctx, tx, r.ID, RoundDecisionOpen, RoundReviewBlind, now, nil); err != nil {
		return err
	}
	return audit.Append(ctx, tx, now, audit.NewEvent{RoomID: t.RoomID, Type: audit.RoundLocked,
		ActorID: actorID, SubjectType: "ROUND", SubjectID: r.ID, Payload: map[string]any{"decision_count": n}})
}

// reveal advances the server-owned replay clock by one round window.
func (s *Service) reveal(ctx context.Context, tx *sql.Tx, r Round, actorID int64, now time.Time) error {
	t, err := lockTrial(ctx, tx, r.TrialID) // lock order: round -> trial
	if err != nil {
		return err
	}
	ds, err := marketdata.GetDataset(ctx, tx, t.DatasetID)
	if err != nil {
		return err
	}
	from := t.ClockIndex
	to := RevealTarget(from, t.RoundBars, ds.CandleCount-1)
	if to <= from {
		return fmt.Errorf("trial %d has no candles left to reveal", t.ID) // prevented by complete()
	}
	if err := advanceClock(ctx, tx, t.ID, to, now); err != nil {
		return err
	}
	if err := updateRoundStatus(ctx, tx, r.ID, RoundReviewBlind, RoundRevealed, now, &to); err != nil {
		return err
	}
	return audit.Append(ctx, tx, now, audit.NewEvent{RoomID: t.RoomID, Type: audit.MarketRevealed,
		ActorID: actorID, SubjectType: "ROUND", SubjectID: r.ID,
		Payload: map[string]any{"from_clock_index": from, "to_clock_index": to}})
}

// complete closes the round and either opens the next one or finishes the
// trial when there is not enough data left for a full round.
func (s *Service) complete(ctx context.Context, tx *sql.Tx, r Round, actorID int64, now time.Time) error {
	t, err := lockTrial(ctx, tx, r.TrialID)
	if err != nil {
		return err
	}
	if err := updateRoundStatus(ctx, tx, r.ID, RoundRevealed, RoundCompleted, now, nil); err != nil {
		return err
	}
	if err := audit.Append(ctx, tx, now, audit.NewEvent{RoomID: t.RoomID, Type: audit.RoundCompleted,
		ActorID: actorID, SubjectType: "ROUND", SubjectID: r.ID}); err != nil {
		return err
	}
	ds, err := marketdata.GetDataset(ctx, tx, t.DatasetID)
	if err != nil {
		return err
	}
	if HasDataForAnotherRound(t.ClockIndex, t.RoundBars, ds.CandleCount-1) {
		return s.openRound(ctx, tx, t, r.RoundNo+1, actorID, now)
	}
	if err := setTrialStatus(ctx, tx, t.ID, TrialRunning, TrialFinished, now); err != nil {
		return err
	}
	return audit.Append(ctx, tx, now, audit.NewEvent{RoomID: t.RoomID, Type: audit.TrialFinished,
		ActorID: actorID, SubjectType: "TRIAL", SubjectID: t.ID})
}

// SubmitReview records a blind checklist review of another member's decision.
func (s *Service) SubmitReview(ctx context.Context, actorID, roundID int64, in ReviewInput, idemKey string) (Review, bool, error) {
	in.Normalize()
	if err := in.Validate(); err != nil {
		return Review{}, false, err
	}
	var reviewID int64
	var replayed bool
	err := database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		now := s.now()
		var err error
		request := struct {
			RoundID int64
			Input   ReviewInput
		}{roundID, in}
		reviewID, replayed, err = idempotency.Run(ctx, tx, now, actorID, "review.submit", idemKey, request,
			func() (int64, error) {
				r, err := lockRound(ctx, tx, roundID)
				if err != nil {
					return 0, err
				}
				t, err := getTrial(ctx, tx, r.TrialID)
				if err != nil {
					return 0, err
				}
				if _, err := rooms.MemberRole(ctx, tx, t.RoomID, actorID); err != nil {
					return 0, hideOutsider(err, ErrRoundNotFound)
				}
				if !r.Status.AcceptsReviews() {
					return 0, ErrReviewNotAllowed
				}
				author, err := decisionAuthor(ctx, tx, in.DecisionID, r.ID)
				if err != nil {
					return 0, err
				}
				if author == actorID {
					return 0, ErrOwnDecisionReview
				}
				id, err := insertReview(ctx, tx, r.ID, actorID, in, now)
				if database.IsDuplicateKey(err) {
					return 0, ErrReviewExists
				}
				if err != nil {
					return 0, fmt.Errorf("insert review: %w", err)
				}
				return id, audit.Append(ctx, tx, now, audit.NewEvent{RoomID: t.RoomID, Type: audit.ReviewSubmitted,
					ActorID: actorID, SubjectType: "REVIEW", SubjectID: id,
					Payload: map[string]any{"round_id": r.ID, "decision_id": in.DecisionID}})
			})
		return err
	})
	if err != nil {
		return Review{}, false, err
	}
	v, err := getReview(ctx, s.db, reviewID)
	return v, replayed, err
}

// hideOutsider turns "not a member of the room" into a not-found error for
// the requested resource, so outsiders cannot probe which IDs exist.
func hideOutsider(err error, notFound error) error {
	if err == rooms.ErrRoomNotFound {
		return notFound
	}
	return err
}
