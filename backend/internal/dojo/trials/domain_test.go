package trials

import (
	"errors"
	"strings"
	"testing"
)

// The round state machine is the heart of the Dojo. Each row is one
// (current status, action) pair and what must happen.
func TestNextStatus(t *testing.T) {
	tests := []struct {
		current     RoundStatus
		action      Action
		want        RoundStatus
		alreadyDone bool
		wantErr     error
	}{
		// Happy path.
		{RoundDecisionOpen, ActionLock, RoundReviewBlind, false, nil},
		{RoundReviewBlind, ActionReveal, RoundRevealed, false, nil},
		{RoundRevealed, ActionComplete, RoundCompleted, false, nil},

		// Repeated requests are no-ops, not errors.
		{RoundReviewBlind, ActionLock, RoundReviewBlind, true, nil},
		{RoundRevealed, ActionReveal, RoundRevealed, true, nil},
		{RoundCompleted, ActionComplete, RoundCompleted, true, nil},

		// Skipping steps is forbidden.
		{RoundDecisionOpen, ActionReveal, "", false, ErrInvalidTransition}, // invariant #3
		{RoundDecisionOpen, ActionComplete, "", false, ErrInvalidTransition},
		{RoundReviewBlind, ActionComplete, "", false, ErrInvalidTransition},

		// Going backwards is forbidden.
		{RoundRevealed, ActionLock, "", false, ErrInvalidTransition},
		{RoundCompleted, ActionLock, "", false, ErrInvalidTransition},
		{RoundCompleted, ActionReveal, "", false, ErrInvalidTransition},

		// Unknown action.
		{RoundDecisionOpen, Action("delete"), "", false, ErrInvalidTransition},
	}
	for _, tc := range tests {
		t.Run(string(tc.current)+"/"+string(tc.action), func(t *testing.T) {
			got, done, err := NextStatus(tc.current, tc.action)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("err = %v, want %v", err, tc.wantErr)
			}
			if got != tc.want || done != tc.alreadyDone {
				t.Fatalf("got (%s, %v), want (%s, %v)", got, done, tc.want, tc.alreadyDone)
			}
		})
	}
}

func TestStatusPermissions(t *testing.T) {
	type perms struct{ decisions, reviews, unsealed, outcome bool }
	want := map[RoundStatus]perms{
		RoundDecisionOpen: {decisions: true},
		RoundReviewBlind:  {reviews: true, unsealed: true},
		RoundRevealed:     {unsealed: true, outcome: true},
		RoundCompleted:    {unsealed: true, outcome: true},
	}
	for s, w := range want {
		got := perms{s.AcceptsDecisions(), s.AcceptsReviews(), s.DecisionsUnsealed(), s.OutcomeVisible()}
		if got != w {
			t.Errorf("%s: got %+v, want %+v", s, got, w)
		}
	}
}

func validDecision() DecisionInput {
	return DecisionInput{Direction: Long, Thesis: "Higher lows after the sweep of the range low",
		Invalidation: "Close below 17990", Confidence: 3}
}

func TestDecisionValidate(t *testing.T) {
	tests := []struct {
		name   string
		modify func(*DecisionInput)
		want   error
	}{
		{"valid long", func(*DecisionInput) {}, nil},
		{"lowercase direction is normalized", func(d *DecisionInput) { d.Direction = " short " }, nil},
		{"wait without invalidation is fine", func(d *DecisionInput) { d.Direction = Wait; d.Invalidation = "" }, nil},
		{"unknown direction", func(d *DecisionInput) { d.Direction = "BUY" }, ErrInvalidDirection},
		{"thesis too short", func(d *DecisionInput) { d.Thesis = "up" }, ErrInvalidThesis},
		{"thesis only spaces", func(d *DecisionInput) { d.Thesis = "            " }, ErrInvalidThesis},
		{"thesis too long", func(d *DecisionInput) { d.Thesis = strings.Repeat("a", 2001) }, ErrInvalidThesis},
		{"long needs invalidation", func(d *DecisionInput) { d.Invalidation = "" }, ErrInvalidationRequired},
		{"short needs invalidation", func(d *DecisionInput) { d.Direction = Short; d.Invalidation = "x" }, ErrInvalidationRequired},
		{"confidence 0", func(d *DecisionInput) { d.Confidence = 0 }, ErrInvalidConfidence},
		{"confidence 6", func(d *DecisionInput) { d.Confidence = 6 }, ErrInvalidConfidence},
		{"risk note too long", func(d *DecisionInput) { d.RiskNote = strings.Repeat("r", 501) }, ErrInvalidRiskNote},
		{"thesis limit counts runes not bytes", func(d *DecisionInput) { d.Thesis = strings.Repeat("ữ", 2000) }, nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			in := validDecision()
			tc.modify(&in)
			in.Normalize()
			if err := in.Validate(); !errors.Is(err, tc.want) {
				t.Fatalf("Validate() = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestReviewValidate(t *testing.T) {
	ok := ReviewInput{DecisionID: 1, Feedback: "  clear plan  "}
	ok.Normalize()
	if err := ok.Validate(); err != nil || ok.Feedback != "clear plan" {
		t.Fatalf("valid review rejected: %v %q", err, ok.Feedback)
	}
	if err := (ReviewInput{DecisionID: 0}).Validate(); !errors.Is(err, ErrDecisionNotFound) {
		t.Fatalf("missing decision id: got %v", err)
	}
	if err := (ReviewInput{DecisionID: 1, Feedback: strings.Repeat("f", 2001)}).Validate(); !errors.Is(err, ErrInvalidFeedback) {
		t.Fatalf("long feedback: got %v", err)
	}
}

// Invariant #4: the replay clock never moves backwards and never past the end.
func TestRevealTarget(t *testing.T) {
	tests := []struct{ clock, bars, last, want int }{
		{119, 30, 599, 149},
		{589, 30, 599, 599}, // clamps to the last candle
		{599, 30, 599, 599}, // at the end: stays
		{700, 30, 599, 700}, // never backwards, even with inconsistent input
	}
	for _, tc := range tests {
		if got := RevealTarget(tc.clock, tc.bars, tc.last); got != tc.want {
			t.Errorf("RevealTarget(%d,%d,%d) = %d, want %d", tc.clock, tc.bars, tc.last, got, tc.want)
		}
	}
	if !HasDataForAnotherRound(569, 30, 599) || HasDataForAnotherRound(570, 30, 599) {
		t.Error("HasDataForAnotherRound boundary is wrong")
	}
	// With the v0.1 sizing, a trial has exactly (600-120)/30 = 16 rounds.
	rounds, clock := 0, WarmupCandles-1
	for HasDataForAnotherRound(clock, RoundBars, DatasetCandles-1) {
		clock = RevealTarget(clock, RoundBars, DatasetCandles-1)
		rounds++
	}
	if rounds != 16 || clock != DatasetCandles-1 {
		t.Errorf("got %d rounds ending at clock %d, want 16 rounds ending at %d", rounds, clock, DatasetCandles-1)
	}
}
