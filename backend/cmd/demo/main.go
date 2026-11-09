// Command demo plays one full Trading Dojo round with two fresh users
// against a running API, printing every step. It is a plain HTTP client:
// read it to see exactly what the frontend does.
//
//	go run ./cmd/demo -base http://localhost:8080    # API directly
//	go run ./cmd/demo -base http://localhost:5173    # through the Vite proxy
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"os"
	"time"
)

type user struct {
	name string
	http *http.Client
	csrf string
	id   int64
}

var base string

func main() {
	flag.StringVar(&base, "base", "http://localhost:8080", "API or frontend base URL")
	flag.Parse()

	suffix := time.Now().Format("150405")
	alice := signup("alice_" + suffix)
	bob := signup("bob_" + suffix)

	var room struct {
		Room struct {
			ID         int64  `json:"id"`
			InviteCode string `json:"invite_code"`
		} `json:"room"`
	}
	alice.call("POST", "/rooms", map[string]string{"name": "Demo room " + suffix}, 201, &room)
	step("alice created room %d (invite %s)", room.Room.ID, room.Room.InviteCode)

	bob.call("POST", "/rooms/join", map[string]string{"invite_code": room.Room.InviteCode}, 201, nil)
	step("bob joined with the invite code")

	var trial struct {
		Trial struct {
			ID         int64 `json:"id"`
			ClockIndex int   `json:"clock_index"`
		} `json:"trial"`
		Dataset struct {
			Label string `json:"label"`
		} `json:"dataset"`
		CurrentRoundID *int64 `json:"current_round_id"`
	}
	alice.call("POST", fmt.Sprintf("/rooms/%d/trials", room.Room.ID), nil, 201, &trial)
	alice.call("POST", fmt.Sprintf("/trials/%d/start", trial.Trial.ID), nil, 200, &trial)
	roundID := *trial.CurrentRoundID
	step("trial %d started: %q, clock=%d, round %d open", trial.Trial.ID, trial.Dataset.Label, trial.Trial.ClockIndex, roundID)

	var candles struct {
		ClockIndex int               `json:"clock_index"`
		Candles    []json.RawMessage `json:"candles"`
	}
	bob.call("GET", fmt.Sprintf("/trials/%d/candles?to=599", trial.Trial.ID), nil, 200, &candles)
	step("bob asked for candles up to 599 and got %d (server clock %d)", len(candles.Candles), candles.ClockIndex)

	commit := func(u *user, dir string) {
		u.call("POST", fmt.Sprintf("/rounds/%d/decisions", roundID), map[string]any{
			"direction": dir, "thesis": "Demo thesis: structure looks " + dir, "invalidation": "Opposite break of range",
			"confidence": 3, "risk_note": "demo"}, 201, nil)
		step("%s committed a sealed %s decision", u.name, dir)
	}
	commit(alice, "LONG")

	var view struct {
		DecisionsSealed bool              `json:"decisions_sealed"`
		Decisions       []json.RawMessage `json:"decisions"`
	}
	bob.call("GET", fmt.Sprintf("/rounds/%d", roundID), nil, 200, &view)
	step("bob's view: sealed=%v, visible decisions=%d", view.DecisionsSealed, len(view.Decisions))
	commit(bob, "SHORT")

	alice.call("POST", fmt.Sprintf("/rounds/%d/decisions", roundID), map[string]any{
		"direction": "SHORT", "thesis": "changing my mind now", "invalidation": "none at all", "confidence": 1}, 409, nil)
	step("alice tried to change her decision -> 409 DECISION_ALREADY_COMMITTED")

	alice.call("POST", fmt.Sprintf("/rounds/%d/lock", roundID), nil, 200, nil)
	step("alice locked the round (REVIEW_BLIND)")

	var locked struct {
		Decisions []struct {
			ID     int64 `json:"id"`
			UserID int64 `json:"user_id"`
		} `json:"decisions"`
	}
	bob.call("GET", fmt.Sprintf("/rounds/%d", roundID), nil, 200, &locked)
	for _, d := range locked.Decisions {
		if d.UserID == alice.id {
			bob.call("POST", fmt.Sprintf("/rounds/%d/reviews", roundID), map[string]any{"decision_id": d.ID,
				"thesis_clear": true, "invalidation_defined": true, "risk_defined": false, "evidence_based": true,
				"feedback": "State position size."}, 201, nil)
			step("bob submitted a blind review of alice's decision")
		}
	}

	bob.call("POST", fmt.Sprintf("/rounds/%d/reveal", roundID), nil, 403, nil)
	step("bob tried to reveal -> 403 OWNER_ONLY")

	var revealed struct {
		Outcome struct {
			ToClockIndex int    `json:"to_clock_index"`
			MoveTicks    int64  `json:"move_ticks"`
			Note         string `json:"note"`
		} `json:"outcome"`
	}
	alice.call("POST", fmt.Sprintf("/rounds/%d/reveal", roundID), nil, 200, &revealed)
	step("alice revealed: clock -> %d, move %d ticks (%s)", revealed.Outcome.ToClockIndex, revealed.Outcome.MoveTicks, revealed.Outcome.Note)

	alice.call("POST", fmt.Sprintf("/rounds/%d/complete", roundID), nil, 200, nil)
	alice.call("GET", fmt.Sprintf("/trials/%d", trial.Trial.ID), nil, 200, &trial)
	step("round completed; next round %d open at clock %d", *trial.CurrentRoundID, trial.Trial.ClockIndex)

	var events struct {
		Events []struct {
			Sequence int64  `json:"sequence"`
			Type     string `json:"type"`
		} `json:"events"`
	}
	bob.call("GET", fmt.Sprintf("/rooms/%d/events", room.Room.ID), nil, 200, &events)
	fmt.Println("\naudit timeline:")
	for _, e := range events.Events {
		fmt.Printf("  #%d %s\n", e.Sequence, e.Type)
	}
	fmt.Printf("\nDEMO OK. Log in as %s / %s (password: demo-password-123) in the UI to look around.\n", alice.name, bob.name)
}

func signup(name string) *user {
	jar, _ := cookiejar.New(nil)
	u := &user{name: name, http: &http.Client{Jar: jar, Timeout: 15 * time.Second}}
	const password = "demo-password-123"
	u.call("POST", "/auth/register", map[string]string{"username": name, "password": password, "display_name": name}, 201, nil)
	var me struct {
		User struct {
			ID int64 `json:"id"`
		} `json:"user"`
		CSRFToken string `json:"csrf_token"`
	}
	u.call("POST", "/auth/login", map[string]string{"username": name, "password": password}, 200, &me)
	u.csrf, u.id = me.CSRFToken, me.User.ID
	step("registered and logged in %s", name)
	return u
}

func (u *user) call(method, path string, body any, wantStatus int, out any) {
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, base+"/api/v1"+path, rd)
	if err != nil {
		fail("%v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if u.csrf != "" {
		req.Header.Set("X-CSRF-Token", u.csrf)
	}
	res, err := u.http.Do(req)
	if err != nil {
		fail("%s %s: %v (is the API running?)", method, path, err)
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	if res.StatusCode != wantStatus {
		fail("%s %s: status %d, want %d: %s", method, path, res.StatusCode, wantStatus, data)
	}
	if out != nil {
		if err := json.Unmarshal(data, out); err != nil {
			fail("%s %s: decode: %v", method, path, err)
		}
	}
}

func step(format string, args ...any) { fmt.Printf("✓ "+format+"\n", args...) }

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "✗ "+format+"\n", args...)
	os.Exit(1)
}
