//go:build integration

package integration

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/audit"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
)

const parallel = 10

// fire runs fn `parallel` times at the same instant and collects results.
func fire(fn func() resp) []resp {
	var wg sync.WaitGroup
	start := make(chan struct{})
	out := make([]resp, parallel)
	for i := range parallel {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			out[i] = fn()
		}()
	}
	close(start)
	wg.Wait()
	return out
}

// Invariant #1 under a race: the same user double-clicks "commit" 10 times.
func TestConcurrentDuplicateDecision(t *testing.T) {
	e := startEnv(t)
	u := e.newUser("racer")
	room := u.createRoom("Race")
	_, roundID := u.startedTrial(room.Room.ID)

	results := fire(func() resp { return u.commit(roundID, "LONG") })
	created, conflicts := 0, 0
	for _, r := range results {
		switch {
		case r.status == 201:
			created++
		case r.status == 409 && r.errorCode() == "DECISION_ALREADY_COMMITTED":
			conflicts++
		default:
			t.Fatalf("unexpected response %d %s", r.status, r.body)
		}
	}
	if created != 1 || conflicts != parallel-1 {
		t.Fatalf("created=%d conflicts=%d", created, conflicts)
	}
	if n := e.countRows("SELECT COUNT(*) FROM decisions WHERE round_id = ?", roundID); n != 1 {
		t.Fatalf("%d decisions stored", n)
	}
	if n := e.countRows("SELECT COUNT(*) FROM audit_events WHERE event_type='DECISION_COMMITTED' AND room_id=?", room.Room.ID); n != 1 {
		t.Fatalf("%d DECISION_COMMITTED events", n)
	}
}

// Invariant #7: a client retrying with the same Idempotency-Key — even
// concurrently — gets the same decision back, never a duplicate or an error.
func TestConcurrentIdempotentDecision(t *testing.T) {
	e := startEnv(t)
	u := e.newUser("retry")
	room := u.createRoom("Retry")
	_, roundID := u.startedTrial(room.Room.ID)

	results := fire(func() resp { return u.commit(roundID, "LONG", "Idempotency-Key", "commit-abc") })
	ids := map[int64]bool{}
	replayed := 0
	for _, r := range results {
		expectStatus(t, r, 201)
		var d struct{ Decision decision }
		r.decode(t, &d)
		ids[d.Decision.ID] = true
		if r.header.Get("Idempotent-Replayed") == "true" {
			replayed++
		}
	}
	if len(ids) != 1 || replayed != parallel-1 {
		t.Fatalf("distinct decision ids=%d replayed=%d", len(ids), replayed)
	}
	// Same key, different payload -> conflict.
	expectError(t, u.commit(roundID, "SHORT", "Idempotency-Key", "commit-abc"), 409, "IDEMPOTENCY_KEY_REUSED")
}

// Invariant #8: concurrent transitions never double-apply.
func TestConcurrentTransitions(t *testing.T) {
	e := startEnv(t)
	owner := e.newUser("owner")
	room := owner.createRoom("Transitions")
	trial, roundID := owner.startedTrial(room.Room.ID)
	expectStatus(t, owner.commit(roundID, "LONG"), 201)

	for _, action := range []string{"lock", "reveal", "complete"} {
		for _, r := range fire(func() resp { return owner.action(roundID, action) }) {
			expectStatus(t, r, 200)
		}
	}
	tv := owner.getTrial(trial.Trial.ID)
	if tv.Trial.ClockIndex != 149 {
		t.Fatalf("concurrent reveals moved the clock to %d, want exactly one window (149)", tv.Trial.ClockIndex)
	}
	if len(tv.Rounds) != 2 {
		t.Fatalf("concurrent completes opened %d rounds, want 2 total", len(tv.Rounds))
	}
	for _, typ := range []string{"ROUND_LOCKED", "MARKET_REVEALED", "ROUND_COMPLETED"} {
		if n := e.countRows("SELECT COUNT(*) FROM audit_events WHERE room_id=? AND event_type=?", room.Room.ID, typ); n != 1 {
			t.Fatalf("%s written %d times", typ, n)
		}
	}
}

// Concurrent commits and lock: every decision is either stored (201) or
// rejected because the round locked (409) — never stored after the lock.
func TestCommitRacingLock(t *testing.T) {
	e := startEnv(t)
	owner := e.newUser("owner")
	room := owner.createRoom("Commit vs lock")
	_, roundID := owner.startedTrial(room.Room.ID)
	expectStatus(t, owner.commit(roundID, "WAIT"), 201)

	members := make([]*client, parallel)
	for i := range members {
		members[i] = e.newUser(fmt.Sprintf("m%d", i))
		members[i].join(room.Room.InviteCode)
	}
	var wg sync.WaitGroup
	start := make(chan struct{})
	results := make([]resp, parallel)
	for i, m := range members {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			results[i] = m.commit(roundID, "SHORT")
		}()
	}
	var lockResp resp
	wg.Add(1)
	go func() {
		defer wg.Done()
		<-start
		time.Sleep(2 * time.Millisecond)
		lockResp = owner.action(roundID, "lock") // t.Fatal is not allowed off the test goroutine
	}()
	close(start)
	wg.Wait()
	expectStatus(t, lockResp, 200)

	accepted := 1 // the owner's
	for _, r := range results {
		switch {
		case r.status == 201:
			accepted++
		case r.status == 409 && r.errorCode() == "ROUND_ALREADY_LOCKED":
		default:
			t.Fatalf("unexpected %d %s", r.status, r.body)
		}
	}
	var lockedAt time.Time
	if err := e.db.QueryRow("SELECT locked_at FROM rounds WHERE id = ?", roundID).Scan(&lockedAt); err != nil {
		t.Fatal(err)
	}
	if late := e.countRows("SELECT COUNT(*) FROM decisions WHERE round_id = ? AND committed_at > ?", roundID, lockedAt); late != 0 {
		t.Fatalf("%d decisions committed after lock", late)
	}
	if n := e.countRows("SELECT COUNT(*) FROM decisions WHERE round_id = ?", roundID); n != accepted {
		t.Fatalf("stored %d decisions but %d requests were accepted", n, accepted)
	}
}

// One unfinished trial per room, enforced by a UNIQUE index even when
// several creates race. Losers roll back their whole transaction, including
// the 600 candles they generated.
func TestConcurrentTrialCreateRollsBackLosers(t *testing.T) {
	e := startEnv(t)
	owner := e.newUser("owner")
	room := owner.createRoom("Create race")
	datasetsBefore := e.countRows("SELECT COUNT(*) FROM datasets")
	candlesBefore := e.countRows("SELECT COUNT(*) FROM candles")

	results := fire(func() resp { return owner.do("POST", fmt.Sprintf("/api/v1/rooms/%d/trials", room.Room.ID), nil) })
	created := 0
	for _, r := range results {
		switch {
		case r.status == 201:
			created++
		case r.status == 409 && r.errorCode() == "ACTIVE_TRIAL_EXISTS":
		default:
			t.Fatalf("unexpected %d %s", r.status, r.body)
		}
	}
	if created != 1 {
		t.Fatalf("%d trials created", created)
	}
	// Datasets are global, other tests may run in parallel packages but not
	// in this package (no t.Parallel), so the delta is exact.
	if d := e.countRows("SELECT COUNT(*) FROM datasets") - datasetsBefore; d != 1 {
		t.Fatalf("%d datasets left behind, want 1 (losers must roll back)", d)
	}
	if d := e.countRows("SELECT COUNT(*) FROM candles") - candlesBefore; d != 600 {
		t.Fatalf("%d candles left behind, want 600", d)
	}
}

// A failure late in a transaction undoes the earlier writes in it.
func TestTransactionRollbackOnFailure(t *testing.T) {
	e := startEnv(t)
	u := e.newUser("rollback")
	ctx := context.Background()
	boom := errors.New("simulated failure after first write")

	err := database.WithTx(ctx, e.db, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `INSERT INTO rooms (name, owner_id, invite_code, status, created_at)
			VALUES ('ghost', ?, 'GHOST00001', 'ACTIVE', NOW(6))`, u.userID); err != nil {
			return err
		}
		return boom
	})
	if !errors.Is(err, boom) {
		t.Fatalf("WithTx returned %v", err)
	}
	if n := e.countRows("SELECT COUNT(*) FROM rooms WHERE invite_code = 'GHOST00001'"); n != 0 {
		t.Fatal("room insert was not rolled back")
	}

	// A failing audit append (room 0 does not exist) rolls back the state change.
	err = database.WithTx(ctx, e.db, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `INSERT INTO rooms (name, owner_id, invite_code, status, created_at)
			VALUES ('ghost2', ?, 'GHOST00002', 'ACTIVE', NOW(6))`, u.userID); err != nil {
			return err
		}
		return audit.Append(ctx, tx, time.Now().UTC(), audit.NewEvent{RoomID: 0, Type: audit.RoomCreated, ActorID: u.userID, SubjectType: "ROOM"})
	})
	if err == nil {
		t.Fatal("expected audit append to fail")
	}
	if n := e.countRows("SELECT COUNT(*) FROM rooms WHERE invite_code = 'GHOST00002'"); n != 0 {
		t.Fatal("state change survived a failed audit write")
	}
}
