//go:build integration

package integration

import (
	"fmt"
	"testing"
)

// Invariant #6: someone outside the room learns nothing — not even that the
// IDs exist (404, not 403).
func TestOutsiderCannotAccessRoomData(t *testing.T) {
	e := startEnv(t)
	owner := e.newUser("owner")
	outsider := e.newUser("mallory")
	room := owner.createRoom("Private")
	trial, roundID := owner.startedTrial(room.Room.ID)
	expectStatus(t, owner.commit(roundID, "LONG"), 201)

	checks := []struct {
		method, path, code string
		body               any
	}{
		{"GET", fmt.Sprintf("/api/v1/rooms/%d", room.Room.ID), "ROOM_NOT_FOUND", nil},
		{"GET", fmt.Sprintf("/api/v1/rooms/%d/events", room.Room.ID), "ROOM_NOT_FOUND", nil},
		{"GET", fmt.Sprintf("/api/v1/rooms/%d/trials", room.Room.ID), "ROOM_NOT_FOUND", nil},
		{"POST", fmt.Sprintf("/api/v1/rooms/%d/trials", room.Room.ID), "ROOM_NOT_FOUND", nil},
		{"GET", fmt.Sprintf("/api/v1/trials/%d", trial.Trial.ID), "TRIAL_NOT_FOUND", nil},
		{"GET", fmt.Sprintf("/api/v1/trials/%d/candles", trial.Trial.ID), "TRIAL_NOT_FOUND", nil},
		{"POST", fmt.Sprintf("/api/v1/trials/%d/start", trial.Trial.ID), "TRIAL_NOT_FOUND", nil},
		{"GET", fmt.Sprintf("/api/v1/rounds/%d", roundID), "ROUND_NOT_FOUND", nil},
		{"POST", fmt.Sprintf("/api/v1/rounds/%d/decisions", roundID), "ROUND_NOT_FOUND", decisionBody("SHORT")},
		{"POST", fmt.Sprintf("/api/v1/rounds/%d/lock", roundID), "ROUND_NOT_FOUND", nil},
		{"POST", fmt.Sprintf("/api/v1/rounds/%d/reveal", roundID), "ROUND_NOT_FOUND", nil},
	}
	for _, c := range checks {
		t.Run(c.method+" "+c.path, func(t *testing.T) {
			expectError(t, outsider.do(c.method, c.path, c.body), 404, c.code)
		})
	}
	if n := e.countRows("SELECT COUNT(*) FROM decisions WHERE user_id = ?", outsider.userID); n != 0 {
		t.Fatal("outsider managed to store a decision")
	}
}

// Only the OWNER drives the session.
func TestMemberCannotRunOwnerActions(t *testing.T) {
	e := startEnv(t)
	owner := e.newUser("owner")
	member := e.newUser("member")
	room := owner.createRoom("Roles")
	member.join(room.Room.InviteCode)

	expectError(t, member.do("POST", fmt.Sprintf("/api/v1/rooms/%d/trials", room.Room.ID), nil), 403, "OWNER_ONLY")
	trial, roundID := owner.startedTrial(room.Room.ID)
	expectStatus(t, member.commit(roundID, "SHORT"), 201)

	expectError(t, member.do("POST", fmt.Sprintf("/api/v1/trials/%d/start", trial.Trial.ID), nil), 403, "OWNER_ONLY")
	expectError(t, member.action(roundID, "lock"), 403, "OWNER_ONLY")
	expectStatus(t, owner.action(roundID, "lock"), 200)
	expectError(t, member.action(roundID, "reveal"), 403, "OWNER_ONLY") // unauthorised reveal
	if got := member.candles(trial.Trial.ID, "").ClockIndex; got != 119 {
		t.Fatalf("clock moved after a rejected reveal: %d", got)
	}
}

func TestSessionAndCSRF(t *testing.T) {
	e := startEnv(t)
	u := e.newUser("sess")

	anon := &client{e: e}
	expectError(t, anon.do("GET", "/api/v1/auth/me", nil), 401, "UNAUTHENTICATED")
	expectError(t, anon.do("GET", "/api/v1/rooms", nil), 401, "UNAUTHENTICATED")

	forged := &client{e: e, session: "not-a-real-session-token", csrf: u.csrf}
	expectError(t, forged.do("GET", "/api/v1/rooms", nil), 401, "UNAUTHENTICATED")

	// A user ID in the body is not a way to act as someone else: unknown
	// fields are rejected outright.
	r := u.do("POST", "/api/v1/rooms", map[string]any{"name": "x", "owner_id": 1})
	expectError(t, r, 400, "INVALID_JSON")

	// Valid cookie without / with wrong CSRF token cannot mutate.
	noCSRF := &client{e: e, session: u.session}
	expectError(t, noCSRF.do("POST", "/api/v1/rooms", map[string]string{"name": "x"}), 403, "CSRF_TOKEN_INVALID")
	wrongCSRF := &client{e: e, session: u.session, csrf: "0000"}
	expectError(t, wrongCSRF.do("POST", "/api/v1/rooms", map[string]string{"name": "x"}), 403, "CSRF_TOKEN_INVALID")
	// ...but can still read (GET is safe).
	expectStatus(t, noCSRF.do("GET", "/api/v1/rooms", nil), 200)

	// Wrong password and unknown user give the same error.
	expectError(t, anon.do("POST", "/api/v1/auth/login", map[string]string{"username": u.username, "password": "wrong password!"}), 401, "INVALID_CREDENTIALS")
	expectError(t, anon.do("POST", "/api/v1/auth/login", map[string]string{"username": "nobody_here", "password": "wrong password!"}), 401, "INVALID_CREDENTIALS")

	// Logout revokes the session server-side.
	expectStatus(t, u.do("POST", "/api/v1/auth/logout", nil), 204)
	expectError(t, u.do("GET", "/api/v1/auth/me", nil), 401, "UNAUTHENTICATED")
}

// Invariant #5: no endpoint returns candles past the server clock, whatever
// the client asks for.
func TestCandlesNeverExceedServerClock(t *testing.T) {
	e := startEnv(t)
	owner := e.newUser("owner")
	room := owner.createRoom("Cutoff")
	trial, roundID := owner.startedTrial(room.Room.ID)

	for _, q := range []string{"", "?to=599", "?cutoff=599&limit=10000", "?clock_index=599", "?from=500"} {
		cv := owner.candles(trial.Trial.ID, q)
		last := cv.Candles[len(cv.Candles)-1].Seq
		if cv.ClockIndex != 119 || last != 119 || len(cv.Candles) != 120 {
			t.Fatalf("query %q returned up to seq %d (%d candles)", q, last, len(cv.Candles))
		}
		if cv.Label != "SYNTHETIC MARKET DATA — NOT REAL NAS100" {
			t.Fatalf("candles response missing synthetic label")
		}
	}
	// Still capped during the blind review phase.
	expectStatus(t, owner.commit(roundID, "LONG"), 201)
	expectStatus(t, owner.action(roundID, "lock"), 200)
	if got := len(owner.candles(trial.Trial.ID, "?to=599").Candles); got != 120 {
		t.Fatalf("REVIEW_BLIND leaked candles: %d", got)
	}
}

// Invariant #9: committed decisions cannot be changed — not through the API,
// and not even with a direct SQL UPDATE/DELETE (triggers).
func TestCommittedDecisionIsImmutable(t *testing.T) {
	e := startEnv(t)
	owner := e.newUser("owner")
	room := owner.createRoom("Immutable")
	_, roundID := owner.startedTrial(room.Room.ID)
	r := owner.commit(roundID, "LONG")
	expectStatus(t, r, 201)
	var d struct{ Decision decision }
	r.decode(t, &d)

	for _, m := range []string{"PUT", "PATCH", "DELETE"} {
		res := owner.do(m, fmt.Sprintf("/api/v1/rounds/%d/decisions", roundID), decisionBody("SHORT"))
		if res.status < 400 {
			t.Fatalf("%s on decisions returned %d", m, res.status)
		}
	}
	if _, err := e.db.Exec("UPDATE decisions SET direction = 'SHORT' WHERE id = ?", d.Decision.ID); err == nil {
		t.Fatal("database allowed UPDATE of a committed decision")
	}
	if _, err := e.db.Exec("DELETE FROM decisions WHERE id = ?", d.Decision.ID); err == nil {
		t.Fatal("database allowed DELETE of a committed decision")
	}
	if _, err := e.db.Exec("UPDATE audit_events SET event_type = 'X' WHERE room_id = ?", room.Room.ID); err == nil {
		t.Fatal("database allowed UPDATE of audit events")
	}
	if got := owner.getRound(roundID).MyDecision; got == nil || got.Direction != "LONG" {
		t.Fatalf("decision changed: %+v", got)
	}
}
