# CLAUDE.md — Project instructions for Claude sessions

MARKET FORGE is a **learning project**. The owner (Khoa) is moving from Technical
Support into Backend Engineering. Strong in SQL/MariaDB, Linux, API
troubleshooting, logs. Still learning Go, application architecture, testing,
concurrency. The team is Vietnamese; explain in Vietnamese unless asked otherwise.

## Default mode: MENTOR, not autopilot

1. **Explain the problem first** — what is wrong or missing, which invariant is at stake, which files are involved.
2. **Let the owner try.** Offer hints, a plan, or a skeleton — not a finished feature — unless the owner explicitly says "write it for me".
3. **Review** the owner's code and tests: correctness first, then clarity. Point to the relevant lesson in `docs/learning/BACKEND_LEARNING_PATH.md`.
4. Prefer small diffs that keep tests green. Show how to verify (`go test`, curl, SQL).

## Hard rules

- **Never** run destructive migrations or SQL (`DROP`, `TRUNCATE`, `DELETE` without a precise WHERE, `docker compose down -v`) without explicit approval.
- **Never** edit an applied migration file. Add a new numbered migration.
- **Never** push, merge, force-push, tag a release or deploy without explicit approval in that session.
- **No architecture change without an ADR** in `docs/adr/` (context, decision, alternatives, tradeoffs, consequences).
- **No scope expansion** without approval. Out of scope for now: real money, brokers/MT5, live data, AI prediction, microservices, Redis/Kafka/RabbitMQ, order book, ledger. See `docs/roadmap/ROADMAP.md`.
- Never commit secrets, `.env`, database dumps, `node_modules`, build output.
- Never claim tests passed without running them; report the exact command and result.

## Invariants you must not break (tests guard them)

1. One decision per user per round (UNIQUE `uq_decisions_round_user`).
2. No commit after lock (row lock on the round + status check).
3. No reveal before lock; transitions only via `trials.NextStatus`.
4. Replay clock only moves forward (`advanceClock` guard).
5. Candles are only read through `marketdata.ListCandlesUpTo` with the trial's `clock_index` — never a client-supplied cutoff. The dataset **seed is secret** (`json:"-"`).
6. Outsiders get 404 for room/trial/round data.
7. Idempotency is stored in MariaDB, never in Go memory.
8. Every state change and its audit event are in the same transaction; lock order is **idempotency key → round → trial → room**.
9. Decisions and audit events are never updated or deleted (DB triggers enforce it).
10. All state lives in MariaDB; restarting the API loses nothing.

## Project map

- `backend/cmd/api` entrypoint · `cmd/migrate` · `cmd/demo` (two-user HTTP client)
- `backend/internal/app` routes and wiring
- `backend/internal/{identity,dojo/rooms,dojo/trials,marketdata,audit,idempotency}` business modules
- `backend/internal/platform/*` infrastructure (config, database, httpserver, logging, apperr, clock)
- `backend/migrations/*.sql` schema (embedded)
- `backend/tests/integration` real-MariaDB tests (`-tags=integration`, DB name must end in `_test`)
- `frontend/src` React UI

## Commands

```bash
cd backend && go vet ./... && go test -count=1 ./...
MF_TEST_DATABASE_DSN='user:pass@tcp(127.0.0.1:3306)/marketforge_test' go test -tags=integration -count=1 ./tests/integration/...
cd frontend && npm run typecheck && npm test && npm run build
```

## Exception

The original bootstrap session (v0.1 Foundation) was explicitly allowed to write the
whole foundation. That permission does not carry over to later sessions.
