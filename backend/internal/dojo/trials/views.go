package trials

import (
	"context"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/dojo/rooms"
	"github.com/khoalysitinh/market-forge/backend/internal/marketdata"
)

// Read side. These functions decide WHAT each member may see. The rules:
//   - outsiders see nothing (404);
//   - candles: only seq <= trial.clock_index, ever;
//   - while DECISION_OPEN, only your own decision; others show "committed: true/false";
//   - decisions of others become visible after lock (REVIEW_BLIND);
//   - the outcome of the reveal window is only computed after REVEALED.

// TrialView is the response of GET /trials/{id}.
type TrialView struct {
	Trial          Trial              `json:"trial"`
	Dataset        marketdata.Dataset `json:"dataset"` // Seed is excluded from JSON
	ClockTime      time.Time          `json:"clock_time"`
	MyRole         rooms.Role         `json:"my_role"`
	Rounds         []Round            `json:"rounds"`
	CurrentRoundID *int64             `json:"current_round_id"`
}

// GetTrial returns a trial for a room member.
func (s *Service) GetTrial(ctx context.Context, actorID, trialID int64) (TrialView, error) {
	t, err := getTrial(ctx, s.db, trialID)
	if err != nil {
		return TrialView{}, err
	}
	role, err := rooms.MemberRole(ctx, s.db, t.RoomID, actorID)
	if err != nil {
		return TrialView{}, hideOutsider(err, ErrTrialNotFound)
	}
	ds, err := marketdata.GetDataset(ctx, s.db, t.DatasetID)
	if err != nil {
		return TrialView{}, err
	}
	rounds, err := listRounds(ctx, s.db, t.ID)
	if err != nil {
		return TrialView{}, err
	}
	v := TrialView{Trial: t, Dataset: ds, MyRole: role, Rounds: rounds,
		ClockTime: ds.StartTime.Add(time.Duration(t.ClockIndex) * time.Minute)}
	for i := range rounds {
		if rounds[i].Status != RoundCompleted {
			id := rounds[i].ID
			v.CurrentRoundID = &id
		}
	}
	return v, nil
}

// ListRoomTrials returns all trials of a room, newest first. Members only.
func (s *Service) ListRoomTrials(ctx context.Context, actorID, roomID int64) ([]Trial, error) {
	if _, err := rooms.MemberRole(ctx, s.db, roomID, actorID); err != nil {
		return nil, err
	}
	return listTrialsForRoom(ctx, s.db, roomID)
}

// CandlesView is the response of GET /trials/{id}/candles.
type CandlesView struct {
	TrialID    int64               `json:"trial_id"`
	ClockIndex int                 `json:"clock_index"`
	Label      string              `json:"label"`
	Symbol     string              `json:"symbol"`
	Timeframe  string              `json:"timeframe"`
	PriceScale int                 `json:"price_scale"`
	Candles    []marketdata.Candle `json:"candles"`
}

// Candles returns every candle the server has revealed so far — and
// nothing beyond. The client cannot pass a cutoff: the only cutoff is the
// trial's clock_index read from the database.
func (s *Service) Candles(ctx context.Context, actorID, trialID int64) (CandlesView, error) {
	t, err := getTrial(ctx, s.db, trialID)
	if err != nil {
		return CandlesView{}, err
	}
	if _, err := rooms.MemberRole(ctx, s.db, t.RoomID, actorID); err != nil {
		return CandlesView{}, hideOutsider(err, ErrTrialNotFound)
	}
	ds, err := marketdata.GetDataset(ctx, s.db, t.DatasetID)
	if err != nil {
		return CandlesView{}, err
	}
	candles, err := marketdata.ListCandlesUpTo(ctx, s.db, t.DatasetID, 0, t.ClockIndex)
	if err != nil {
		return CandlesView{}, err
	}
	return CandlesView{TrialID: t.ID, ClockIndex: t.ClockIndex, Label: ds.Label, Symbol: ds.Symbol,
		Timeframe: ds.Timeframe, PriceScale: ds.PriceScale, Candles: candles}, nil
}

// Participant is a room member's status in a round.
type Participant struct {
	UserID      int64      `json:"user_id"`
	DisplayName string     `json:"display_name"`
	Role        rooms.Role `json:"role"`
	Committed   bool       `json:"committed"`
}

// Outcome describes the market move over the revealed window. It is a
// market fact, not a trading result: no P&L is computed.
type Outcome struct {
	FromClockIndex int    `json:"from_clock_index"`
	ToClockIndex   int    `json:"to_clock_index"`
	DecisionClose  int64  `json:"decision_close"`
	RevealClose    int64  `json:"reveal_close"`
	WindowHigh     int64  `json:"window_high"`
	WindowLow      int64  `json:"window_low"`
	MoveTicks      int64  `json:"move_ticks"`
	PriceScale     int    `json:"price_scale"`
	Note           string `json:"note"`
}

const outcomeNote = "Market move only. No P&L is computed: entries, exits, spread, commission " +
	"and slippage are not modelled in v0.1. Synthetic data — not real trading performance."

// RoundView is the response of GET /rounds/{id} and of round transitions.
type RoundView struct {
	Round           Round         `json:"round"`
	RoomID          int64         `json:"room_id"`
	MyRole          rooms.Role    `json:"my_role"`
	Participants    []Participant `json:"participants"`
	MyDecision      *Decision     `json:"my_decision"`
	DecisionsSealed bool          `json:"decisions_sealed"`
	Decisions       []Decision    `json:"decisions"` // empty while sealed
	Reviews         []Review      `json:"reviews"`   // empty while sealed
	Outcome         *Outcome      `json:"outcome"`   // nil until REVEALED
}

// GetRound returns what the actor is allowed to see about a round.
func (s *Service) GetRound(ctx context.Context, actorID, roundID int64) (RoundView, error) {
	r, err := getRound(ctx, s.db, roundID)
	if err != nil {
		return RoundView{}, err
	}
	t, err := getTrial(ctx, s.db, r.TrialID)
	if err != nil {
		return RoundView{}, err
	}
	role, err := rooms.MemberRole(ctx, s.db, t.RoomID, actorID)
	if err != nil {
		return RoundView{}, hideOutsider(err, ErrRoundNotFound)
	}
	members, err := rooms.ListMembers(ctx, s.db, t.RoomID)
	if err != nil {
		return RoundView{}, err
	}
	all, err := listDecisions(ctx, s.db, r.ID)
	if err != nil {
		return RoundView{}, err
	}

	v := RoundView{Round: r, RoomID: t.RoomID, MyRole: role,
		DecisionsSealed: !r.Status.DecisionsUnsealed(), Decisions: []Decision{}, Reviews: []Review{}}

	committed := map[int64]bool{}
	for i := range all {
		committed[all[i].UserID] = true
		if all[i].UserID == actorID {
			d := all[i]
			v.MyDecision = &d
		}
	}
	for _, m := range members {
		v.Participants = append(v.Participants, Participant{UserID: m.UserID, DisplayName: m.DisplayName,
			Role: m.Role, Committed: committed[m.UserID]})
	}

	if !v.DecisionsSealed {
		v.Decisions = all
		if v.Reviews, err = listReviews(ctx, s.db, r.ID); err != nil {
			return RoundView{}, err
		}
	}

	if r.Status.OutcomeVisible() && r.RevealClockIndex != nil {
		if v.Outcome, err = s.outcome(ctx, t, r.DecisionClockIndex, *r.RevealClockIndex); err != nil {
			return RoundView{}, err
		}
	}
	return v, nil
}

func (s *Service) outcome(ctx context.Context, t Trial, from, to int) (*Outcome, error) {
	// to <= t.ClockIndex always holds (reveal sets both in one transaction),
	// so this never reads past the server cutoff.
	candles, err := marketdata.ListCandlesUpTo(ctx, s.db, t.DatasetID, from, min(to, t.ClockIndex))
	if err != nil {
		return nil, err
	}
	if len(candles) < 2 {
		return nil, nil
	}
	o := &Outcome{FromClockIndex: from, ToClockIndex: to, DecisionClose: candles[0].Close,
		RevealClose: candles[len(candles)-1].Close, PriceScale: marketdata.PriceScale, Note: outcomeNote}
	o.WindowHigh, o.WindowLow = candles[1].High, candles[1].Low
	for _, c := range candles[1:] {
		o.WindowHigh = max(o.WindowHigh, c.High)
		o.WindowLow = min(o.WindowLow, c.Low)
	}
	o.MoveTicks = o.RevealClose - o.DecisionClose
	return o, nil
}
