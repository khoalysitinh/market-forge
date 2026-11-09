//go:build integration

package integration

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"testing"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
	"github.com/khoalysitinh/market-forge/backend/migrations"
)

func TestMigrationsAppliedAndRerunIsNoop(t *testing.T) {
	e := startEnv(t)
	files, _ := migrations.FS.ReadDir(".")
	sqlFiles := 0
	for _, f := range files {
		if len(f.Name()) > 4 && f.Name()[len(f.Name())-4:] == ".sql" {
			sqlFiles++
		}
	}
	if got := e.countRows("SELECT COUNT(*) FROM schema_migrations"); got != sqlFiles {
		t.Fatalf("schema_migrations has %d rows, want %d", got, sqlFiles)
	}

	mdb, err := database.Open(context.Background(), testDSN, database.Options{MultiStatements: true})
	if err != nil {
		t.Fatal(err)
	}
	defer mdb.Close()
	if err := database.Migrate(context.Background(), mdb, migrations.FS, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatalf("second migrate run failed: %v", err)
	}

	c := &client{e: e}
	expectStatus(t, c.do("GET", "/api/v1/health", nil), 200)
	expectStatus(t, c.do("GET", "/api/v1/ready", nil), 200)
}

// The main Trading Dojo loop with two users, then a simulated restart.
func TestTwoUserDojoFlowSurvivesRestart(t *testing.T) {
	e := startEnv(t)
	alice := e.newUser("alice")
	bob := e.newUser("bob")

	// Room: alice creates, bob joins with the invite code.
	room := alice.createRoom("Morning session")
	if room.MyRole != "OWNER" {
		t.Fatalf("creator role = %s", room.MyRole)
	}
	joined := bob.join(room.Room.InviteCode)
	if joined.MyRole != "MEMBER" || len(joined.Members) != 2 {
		t.Fatalf("join result: %+v", joined)
	}
	// Joining twice is a no-op (200, not a second membership).
	expectStatus(t, bob.do("POST", "/api/v1/rooms/join", map[string]string{"invite_code": room.Room.InviteCode}), 200)

	// Trial: warm-up candles visible, round 1 open at the warm-up clock.
	trial, roundID := alice.startedTrial(room.Room.ID)
	if trial.Trial.Status != "RUNNING" || trial.Trial.ClockIndex != 119 {
		t.Fatalf("trial after start: %+v", trial.Trial)
	}
	if trial.Dataset["label"] != "SYNTHETIC MARKET DATA — NOT REAL NAS100" {
		t.Fatalf("dataset label missing: %v", trial.Dataset["label"])
	}
	if _, leaked := trial.Dataset["seed"]; leaked {
		t.Fatal("dataset seed must never be exposed")
	}
	cv := bob.candles(trial.Trial.ID, "")
	if len(cv.Candles) != 120 || cv.Candles[119].Seq != 119 {
		t.Fatalf("expected 120 warm-up candles, got %d", len(cv.Candles))
	}

	// Alice commits. Bob sees THAT she committed, not WHAT.
	r := alice.commit(roundID, "LONG")
	expectStatus(t, r, 201)
	var aliceDecision struct{ Decision decision }
	r.decode(t, &aliceDecision)
	if aliceDecision.Decision.KnownAtClockIndex != 119 || aliceDecision.Decision.DatasetFingerprint != trial.Trial.DatasetFingerprint {
		t.Fatalf("server did not stamp clock/fingerprint: %+v", aliceDecision.Decision)
	}
	bv := bob.getRound(roundID)
	if !bv.DecisionsSealed || len(bv.Decisions) != 0 || bv.MyDecision != nil {
		t.Fatalf("decisions must be sealed for bob: %+v", bv)
	}
	committed := map[int64]bool{}
	for _, p := range bv.Participants {
		committed[p.UserID] = p.Committed
	}
	if !committed[alice.userID] || committed[bob.userID] {
		t.Fatalf("participant commit flags wrong: %+v", bv.Participants)
	}

	expectStatus(t, bob.commit(roundID, "SHORT"), 201)

	// Second decision from the same user is rejected; the original stays.
	expectError(t, alice.commit(roundID, "SHORT"), 409, "DECISION_ALREADY_COMMITTED")

	// Lock. A late joiner cannot commit any more.
	expectStatus(t, alice.action(roundID, "lock"), 200)
	carol := e.newUser("carol")
	carol.join(room.Room.InviteCode)
	expectError(t, carol.commit(roundID, "WAIT"), 409, "ROUND_ALREADY_LOCKED")

	// Blind review: decisions now visible, outcome and future candles still hidden.
	bv = bob.getRound(roundID)
	if bv.DecisionsSealed || len(bv.Decisions) != 2 || bv.Outcome != nil {
		t.Fatalf("REVIEW_BLIND view wrong: sealed=%v decisions=%d outcome=%v", bv.DecisionsSealed, len(bv.Decisions), bv.Outcome)
	}
	if got := bob.candles(trial.Trial.ID, "").ClockIndex; got != 119 {
		t.Fatalf("clock moved before reveal: %d", got)
	}
	review := map[string]any{"decision_id": aliceDecision.Decision.ID, "thesis_clear": true,
		"invalidation_defined": true, "risk_defined": false, "evidence_based": true, "feedback": "Define size."}
	expectStatus(t, bob.do("POST", fmt.Sprintf("/api/v1/rounds/%d/reviews", roundID), review), 201)
	expectError(t, bob.do("POST", fmt.Sprintf("/api/v1/rounds/%d/reviews", roundID), review), 409, "REVIEW_ALREADY_SUBMITTED")

	// Reviewing your own decision is not allowed.
	var bobDecisionID int64
	for _, d := range bv.Decisions {
		if d.UserID == bob.userID {
			bobDecisionID = d.ID
		}
	}
	own := map[string]any{"decision_id": bobDecisionID, "thesis_clear": true, "invalidation_defined": true,
		"risk_defined": true, "evidence_based": true}
	expectError(t, bob.do("POST", fmt.Sprintf("/api/v1/rounds/%d/reviews", roundID), own), 422, "CANNOT_REVIEW_OWN_DECISION")

	// Reveal: clock advances exactly one window; outcome appears.
	expectStatus(t, alice.action(roundID, "reveal"), 200)
	bv = bob.getRound(roundID)
	if bv.Round.Status != "REVEALED" || bv.Outcome == nil || bv.Outcome.ToClockIndex != 149 || bv.Outcome.Note == "" {
		t.Fatalf("after reveal: %+v outcome=%+v", bv.Round, bv.Outcome)
	}
	if got := len(bob.candles(trial.Trial.ID, "").Candles); got != 150 {
		t.Fatalf("after reveal expected 150 candles, got %d", got)
	}
	// Reviews close once the future is visible.
	review["decision_id"] = aliceDecision.Decision.ID
	expectError(t, carol.do("POST", fmt.Sprintf("/api/v1/rounds/%d/reviews", roundID), review), 409, "REVIEW_NOT_ALLOWED")

	// Complete: round 2 opens at the new clock.
	expectStatus(t, alice.action(roundID, "complete"), 200)
	tv := alice.getTrial(trial.Trial.ID)
	if len(tv.Rounds) != 2 || tv.Rounds[0].Status != "COMPLETED" || tv.Rounds[1].Status != "DECISION_OPEN" ||
		tv.Rounds[1].DecisionClockIndex != 149 || tv.CurrentRoundID == nil || *tv.CurrentRoundID != tv.Rounds[1].ID {
		t.Fatalf("after complete: %+v", tv.Rounds)
	}

	// Audit timeline has every step, in order, with gap-free sequence numbers.
	var events struct {
		Events []struct {
			Sequence int64  `json:"sequence"`
			Type     string `json:"type"`
		} `json:"events"`
	}
	r = bob.do("GET", fmt.Sprintf("/api/v1/rooms/%d/events", room.Room.ID), nil)
	expectStatus(t, r, 200)
	r.decode(t, &events)
	want := []string{"ROOM_CREATED", "MEMBER_JOINED", "TRIAL_CREATED", "TRIAL_STARTED", "ROUND_OPENED",
		"DECISION_COMMITTED", "DECISION_COMMITTED", "ROUND_LOCKED", "MEMBER_JOINED", "REVIEW_SUBMITTED",
		"MARKET_REVEALED", "ROUND_COMPLETED", "ROUND_OPENED"}
	if len(events.Events) != len(want) {
		t.Fatalf("got %d events, want %d: %+v", len(events.Events), len(want), events.Events)
	}
	for i, ev := range events.Events {
		if ev.Type != want[i] || ev.Sequence != int64(i+1) {
			t.Fatalf("event %d = (%d, %s), want (%d, %s)", i, ev.Sequence, ev.Type, i+1, want[i])
		}
	}

	// ---- Restart: stop this "process", boot a new one on the same DB. ----
	e.stop()
	e2 := startEnv(t)
	alice2, bob2 := alice.on(e2), bob.on(e2)

	tv2 := bob2.getTrial(trial.Trial.ID) // the old session cookie still works
	if tv2.Trial.ClockIndex != 149 || tv2.Trial.Status != "RUNNING" || len(tv2.Rounds) != 2 {
		t.Fatalf("state after restart: %+v rounds=%d", tv2.Trial, len(tv2.Rounds))
	}
	r1 := alice2.getRound(roundID)
	if r1.Round.Status != "COMPLETED" || len(r1.Decisions) != 2 || len(r1.Reviews) != 1 {
		t.Fatalf("round 1 after restart: %+v", r1)
	}
	for _, d := range r1.Decisions {
		if d.UserID == alice.userID && d.Direction != "LONG" {
			t.Fatalf("alice's committed decision changed: %+v", d)
		}
	}
	if got := len(bob2.candles(trial.Trial.ID, "").Candles); got != 150 {
		t.Fatalf("after restart expected 150 candles, got %d", got)
	}
}

// Play every round until the dataset runs out; then a new trial is allowed.
func TestTrialRunsToFinish(t *testing.T) {
	e := startEnv(t)
	owner := e.newUser("owner")
	room := owner.createRoom("Full run")
	trial, roundID := owner.startedTrial(room.Room.ID)

	// Only one unfinished trial per room.
	expectError(t, owner.do("POST", fmt.Sprintf("/api/v1/rooms/%d/trials", room.Room.ID), nil), 409, "ACTIVE_TRIAL_EXISTS")

	rounds := 0
	for {
		expectStatus(t, owner.commit(roundID, "WAIT"), 201)
		expectStatus(t, owner.action(roundID, "lock"), 200)
		expectStatus(t, owner.action(roundID, "reveal"), 200)
		expectStatus(t, owner.action(roundID, "complete"), 200)
		rounds++
		tv := owner.getTrial(trial.Trial.ID)
		if tv.CurrentRoundID == nil {
			if tv.Trial.Status != "FINISHED" || tv.Trial.ClockIndex != 599 {
				t.Fatalf("finished trial state: %+v", tv.Trial)
			}
			break
		}
		roundID = *tv.CurrentRoundID
		if rounds > 20 {
			t.Fatal("trial never finished")
		}
	}
	if rounds != 16 {
		t.Fatalf("played %d rounds, want 16", rounds)
	}
	expectStatus(t, owner.do("POST", fmt.Sprintf("/api/v1/rooms/%d/trials", room.Room.ID), nil), 201)
}

func TestTransitionPreconditions(t *testing.T) {
	e := startEnv(t)
	owner := e.newUser("owner")
	room := owner.createRoom("Preconditions")
	_, roundID := owner.startedTrial(room.Room.ID)

	expectError(t, owner.action(roundID, "reveal"), 409, "INVALID_ROUND_TRANSITION")   // invariant #3
	expectError(t, owner.action(roundID, "complete"), 409, "INVALID_ROUND_TRANSITION") // cannot skip
	expectError(t, owner.action(roundID, "lock"), 422, "NO_DECISIONS_TO_LOCK")

	expectStatus(t, owner.commit(roundID, "WAIT"), 201)
	expectStatus(t, owner.action(roundID, "lock"), 200)
	expectStatus(t, owner.action(roundID, "lock"), 200) // repeat = no-op
	if n := e.countRows("SELECT COUNT(*) FROM audit_events WHERE event_type='ROUND_LOCKED' AND subject_id=?", roundID); n != 1 {
		t.Fatalf("repeated lock wrote %d ROUND_LOCKED events, want 1", n)
	}
	expectError(t, owner.action(roundID, "complete"), 409, "INVALID_ROUND_TRANSITION")
}

func TestIdempotentRoomCreate(t *testing.T) {
	e := startEnv(t)
	u := e.newUser("idem")
	key := []string{"Idempotency-Key", "room-create-1"}
	r1 := u.do("POST", "/api/v1/rooms", map[string]string{"name": "Once"}, key...)
	r2 := u.do("POST", "/api/v1/rooms", map[string]string{"name": "Once"}, key...)
	expectStatus(t, r1, 201)
	expectStatus(t, r2, 201)
	var d1, d2 roomDetail
	r1.decode(t, &d1)
	r2.decode(t, &d2)
	if d1.Room.ID != d2.Room.ID || r2.header.Get("Idempotent-Replayed") != "true" {
		t.Fatalf("retry created a second room (%d vs %d)", d1.Room.ID, d2.Room.ID)
	}
	expectError(t, u.do("POST", "/api/v1/rooms", map[string]string{"name": "Other"}, key...), 409, "IDEMPOTENCY_KEY_REUSED")
	if n := e.countRows("SELECT COUNT(*) FROM rooms WHERE owner_id = ?", u.userID); n != 1 {
		t.Fatalf("user owns %d rooms, want 1", n)
	}
}
