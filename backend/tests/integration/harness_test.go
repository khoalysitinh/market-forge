//go:build integration

// Package integration runs the real HTTP API against a real MariaDB.
//
//	MF_TEST_DATABASE_DSN='marketforge:marketforge_dev@tcp(127.0.0.1:3306)/marketforge_test' \
//	  go test -tags=integration -count=1 ./tests/integration/...
//
// SAFETY: TestMain DROPS AND RECREATES the target database. It refuses to
// run unless the database name ends with "_test".
package integration

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/khoalysitinh/market-forge/backend/internal/app"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/clock"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
	"github.com/khoalysitinh/market-forge/backend/migrations"
)

var (
	testDSN string
	seedSeq atomic.Uint64
	userSeq atomic.Int64
)

func TestMain(m *testing.M) {
	testDSN = os.Getenv("MF_TEST_DATABASE_DSN")
	if testDSN == "" {
		fmt.Fprintln(os.Stderr, "MF_TEST_DATABASE_DSN is not set; integration tests need a disposable MariaDB database")
		os.Exit(1)
	}
	if err := resetDatabase(testDSN); err != nil {
		fmt.Fprintln(os.Stderr, "reset test database:", err)
		os.Exit(1)
	}
	os.Exit(m.Run())
}

// resetDatabase drops and recreates the *_test database, then migrates it.
func resetDatabase(dsn string) error {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return err
	}
	if !strings.HasSuffix(cfg.DBName, "_test") {
		return fmt.Errorf("refusing to reset database %q: name must end with _test", cfg.DBName)
	}
	name := cfg.DBName
	cfg.DBName = ""
	ctx := context.Background()
	server, err := database.Open(ctx, cfg.FormatDSN(), database.Options{})
	if err != nil {
		return err
	}
	defer server.Close()
	// Identifier quoting with backticks; name was validated above and comes
	// from our own environment variable, not from user input.
	if _, err := server.ExecContext(ctx, "DROP DATABASE IF EXISTS `"+name+"`"); err != nil {
		return err
	}
	if _, err := server.ExecContext(ctx, "CREATE DATABASE `"+name+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); err != nil {
		return err
	}
	mdb, err := database.Open(ctx, dsn, database.Options{MultiStatements: true})
	if err != nil {
		return err
	}
	defer mdb.Close()
	return database.Migrate(ctx, mdb, migrations.FS, slog.New(slog.NewTextHandler(io.Discard, nil)))
}

// env is one running API instance ("process") with its own DB pool.
type env struct {
	t      *testing.T
	db     *sql.DB
	server *httptest.Server
}

// startEnv boots the full application exactly like cmd/api does, but on a
// random local port. Calling it twice simulates a process restart.
func startEnv(t *testing.T) *env {
	t.Helper()
	db, err := database.Open(context.Background(), testDSN, database.Options{})
	if err != nil {
		t.Fatal(err)
	}
	h, err := app.NewHandler(app.Deps{
		DB:  db,
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		Now: clock.System,
		// Deterministic, distinct seeds so failures are reproducible.
		Seed:       func() (uint64, error) { return 10_000 + seedSeq.Add(1), nil },
		BcryptCost: 4, // bcrypt.MinCost: fast tests. Production uses 12.
		SessionTTL: time.Hour,
	})
	if err != nil {
		t.Fatal(err)
	}
	e := &env{t: t, db: db, server: httptest.NewServer(h)}
	t.Cleanup(e.stop)
	return e
}

func (e *env) stop() {
	e.server.Close()
	_ = e.db.Close()
}

// client is one browser: it keeps its own session cookie and CSRF token.
type client struct {
	e        *env
	name     string
	userID   int64
	username string
	session  string
	csrf     string
}

type resp struct {
	status int
	body   []byte
	header http.Header
}

func (r resp) errorCode() string {
	var b struct {
		Error struct{ Code string } `json:"error"`
	}
	_ = json.Unmarshal(r.body, &b)
	return b.Error.Code
}

func (r resp) decode(t *testing.T, dst any) {
	t.Helper()
	if err := json.Unmarshal(r.body, dst); err != nil {
		t.Fatalf("decode %s: %v", r.body, err)
	}
}

// do sends a request. body may be nil. Extra headers come in pairs.
func (c *client) do(method, path string, body any, headers ...string) resp {
	c.e.t.Helper()
	var rd io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			c.e.t.Fatal(err)
		}
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.e.server.URL+path, rd)
	if err != nil {
		c.e.t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.session != "" {
		req.AddCookie(&http.Cookie{Name: "mf_session", Value: c.session})
	}
	if c.csrf != "" {
		req.Header.Set("X-CSRF-Token", c.csrf)
	}
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		c.e.t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return resp{status: res.StatusCode, body: b, header: res.Header}
}

// on returns a copy of the client pointed at another env (same cookies).
func (c *client) on(e *env) *client {
	cp := *c
	cp.e = e
	return &cp
}

// newUser registers and logs in a fresh user with a unique username.
func (e *env) newUser(name string) *client {
	e.t.Helper()
	c := &client{e: e, name: name}
	c.username = fmt.Sprintf("%s_%d_%d", name, time.Now().UnixNano()%1_000_000, userSeq.Add(1))
	password := "correct horse battery staple"
	r := c.do("POST", "/api/v1/auth/register", map[string]string{
		"username": c.username, "password": password, "display_name": name})
	expectStatus(e.t, r, 201)

	r = c.do("POST", "/api/v1/auth/login", map[string]string{"username": c.username, "password": password})
	expectStatus(e.t, r, 200)
	for _, ck := range (&http.Response{Header: r.header}).Cookies() {
		if ck.Name == "mf_session" {
			c.session = ck.Value
			if !ck.HttpOnly {
				e.t.Fatal("session cookie must be HttpOnly")
			}
		}
	}
	var me struct {
		User      struct{ ID int64 } `json:"user"`
		CSRFToken string             `json:"csrf_token"`
	}
	r.decode(e.t, &me)
	c.userID, c.csrf = me.User.ID, me.CSRFToken
	if c.session == "" || c.csrf == "" {
		e.t.Fatal("login did not return a session cookie and csrf token")
	}
	return c
}

func expectStatus(t *testing.T, r resp, want int) {
	t.Helper()
	if r.status != want {
		t.Fatalf("status %d, want %d; body: %s", r.status, want, r.body)
	}
}

func expectError(t *testing.T, r resp, status int, code string) {
	t.Helper()
	if r.status != status || r.errorCode() != code {
		t.Fatalf("got %d %q, want %d %q; body: %s", r.status, r.errorCode(), status, code, r.body)
	}
}

// ---- typed views of API responses used by the tests ----

type roomDetail struct {
	Room struct {
		ID         int64  `json:"id"`
		InviteCode string `json:"invite_code"`
	} `json:"room"`
	MyRole  string `json:"my_role"`
	Members []struct {
		UserID int64  `json:"user_id"`
		Role   string `json:"role"`
	} `json:"members"`
}

type trialView struct {
	Trial struct {
		ID                 int64  `json:"id"`
		Status             string `json:"status"`
		ClockIndex         int    `json:"clock_index"`
		DatasetFingerprint string `json:"dataset_fingerprint"`
	} `json:"trial"`
	Dataset        map[string]any `json:"dataset"`
	Rounds         []roundRow     `json:"rounds"`
	CurrentRoundID *int64         `json:"current_round_id"`
}

type roundRow struct {
	ID                 int64  `json:"id"`
	RoundNo            int    `json:"round_no"`
	Status             string `json:"status"`
	DecisionClockIndex int    `json:"decision_clock_index"`
	RevealClockIndex   *int   `json:"reveal_clock_index"`
}

type decision struct {
	ID                 int64  `json:"id"`
	UserID             int64  `json:"user_id"`
	Direction          string `json:"direction"`
	Thesis             string `json:"thesis"`
	KnownAtClockIndex  int    `json:"known_at_clock_index"`
	DatasetFingerprint string `json:"dataset_fingerprint"`
}

type roundView struct {
	Round        roundRow `json:"round"`
	Participants []struct {
		UserID    int64 `json:"user_id"`
		Committed bool  `json:"committed"`
	} `json:"participants"`
	MyDecision      *decision  `json:"my_decision"`
	DecisionsSealed bool       `json:"decisions_sealed"`
	Decisions       []decision `json:"decisions"`
	Reviews         []struct {
		DecisionID int64 `json:"decision_id"`
		ReviewerID int64 `json:"reviewer_id"`
	} `json:"reviews"`
	Outcome *struct {
		FromClockIndex int    `json:"from_clock_index"`
		ToClockIndex   int    `json:"to_clock_index"`
		MoveTicks      int64  `json:"move_ticks"`
		Note           string `json:"note"`
	} `json:"outcome"`
}

type candlesView struct {
	ClockIndex int    `json:"clock_index"`
	Label      string `json:"label"`
	Candles    []struct {
		Seq int `json:"seq"`
	} `json:"candles"`
}

// ---- scenario helpers ----

func (c *client) createRoom(name string) roomDetail {
	c.e.t.Helper()
	r := c.do("POST", "/api/v1/rooms", map[string]string{"name": name})
	expectStatus(c.e.t, r, 201)
	var d roomDetail
	r.decode(c.e.t, &d)
	return d
}

func (c *client) join(code string) roomDetail {
	c.e.t.Helper()
	r := c.do("POST", "/api/v1/rooms/join", map[string]string{"invite_code": code})
	expectStatus(c.e.t, r, 201)
	var d roomDetail
	r.decode(c.e.t, &d)
	return d
}

// startedTrial creates and starts a trial; returns the trial and round 1.
func (c *client) startedTrial(roomID int64) (trialView, int64) {
	c.e.t.Helper()
	r := c.do("POST", fmt.Sprintf("/api/v1/rooms/%d/trials", roomID), nil)
	expectStatus(c.e.t, r, 201)
	var tv trialView
	r.decode(c.e.t, &tv)
	r = c.do("POST", fmt.Sprintf("/api/v1/trials/%d/start", tv.Trial.ID), nil)
	expectStatus(c.e.t, r, 200)
	r.decode(c.e.t, &tv)
	if tv.CurrentRoundID == nil {
		c.e.t.Fatal("started trial has no current round")
	}
	return tv, *tv.CurrentRoundID
}

func (c *client) getRound(id int64) roundView {
	c.e.t.Helper()
	r := c.do("GET", fmt.Sprintf("/api/v1/rounds/%d", id), nil)
	expectStatus(c.e.t, r, 200)
	var v roundView
	r.decode(c.e.t, &v)
	return v
}

func (c *client) getTrial(id int64) trialView {
	c.e.t.Helper()
	r := c.do("GET", fmt.Sprintf("/api/v1/trials/%d", id), nil)
	expectStatus(c.e.t, r, 200)
	var v trialView
	r.decode(c.e.t, &v)
	return v
}

func (c *client) candles(trialID int64, query string) candlesView {
	c.e.t.Helper()
	r := c.do("GET", fmt.Sprintf("/api/v1/trials/%d/candles%s", trialID, query), nil)
	expectStatus(c.e.t, r, 200)
	var v candlesView
	r.decode(c.e.t, &v)
	return v
}

func decisionBody(direction string) map[string]any {
	return map[string]any{
		"direction":    direction,
		"thesis":       "Range high swept then reclaimed; expecting continuation",
		"invalidation": "M1 close back inside the range",
		"confidence":   3,
		"risk_note":    "Risk 0.5R; costs not modelled",
	}
}

func (c *client) commit(roundID int64, direction string, headers ...string) resp {
	return c.do("POST", fmt.Sprintf("/api/v1/rounds/%d/decisions", roundID), decisionBody(direction), headers...)
}

func (c *client) action(roundID int64, action string) resp {
	return c.do("POST", fmt.Sprintf("/api/v1/rounds/%d/%s", roundID, action), nil)
}

func (e *env) countRows(query string, args ...any) int {
	e.t.Helper()
	var n int
	if err := e.db.QueryRow(query, args...).Scan(&n); err != nil {
		e.t.Fatal(err)
	}
	return n
}
