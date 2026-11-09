# MARKET FORGE — Architecture (v0.1 Foundation)

Tài liệu này giải thích **tại sao** hệ thống được xây như hiện tại. Đọc cùng source code: mỗi mục đều chỉ ra file liên quan.

## 1. Tại sao Modular Monolith

Một binary Go (`backend/cmd/api`), một database MariaDB, các module nghiệp vụ tách thư mục.

- Nhóm 3–6 người, tải rất nhỏ: microservices chỉ thêm network, deploy, distributed transaction mà không giải quyết vấn đề nào ta đang có.
- Các invariant quan trọng nhất (commit vs lock, reveal vs clock) cần **một transaction** trên nhiều bảng. Trong monolith, đó là một `BEGIN … COMMIT`. Tách service thì phải dùng saga/outbox — Phase 5.
- Ranh giới module vẫn rõ để sau này tách được nếu *đo được* nhu cầu. Xem [ADR-001](../adr/ADR-001-go-modular-monolith.md).

## 2. Vì sao Go

- Standard library đủ cho HTTP server (`net/http` với routing theo method + path param từ Go 1.22), JSON, `database/sql`, `log/slog`, crypto.
- Biên dịch ra một file tĩnh, khởi động nhanh, dễ chạy trong Docker distroless.
- Error handling tường minh (`if err != nil`) — phù hợp với mục tiêu học: mọi đường lỗi đều nhìn thấy được.
- Concurrency (goroutine) có sẵn, và `go test -race` giúp phát hiện data race.

Phụ thuộc bên ngoài của backend: chỉ `github.com/go-sql-driver/mysql` (driver) và `golang.org/x/crypto` (bcrypt). Không router, không ORM, không framework.

## 3. Modules

```text
cmd/api ─► internal/app ─┬─► identity ───────────────┐
                         ├─► dojo/rooms ─────────────┤
                         ├─► dojo/trials ─► rooms    ├─► platform/{apperr,clock,database,httpserver}
                         │               ─► marketdata│
                         │               ─► audit     │
                         │               ─► idempotency
                         └─► migrations (embed)
```

| Package | Trách nhiệm |
|---|---|
| `internal/platform/config` | Đọc biến môi trường, giá trị mặc định an toàn |
| `internal/platform/database` | Mở pool, `WithTx` (retry deadlock), `Migrate`, `IsDuplicateKey` |
| `internal/platform/httpserver` | `DecodeJSON`, `WriteJSON`, `WriteError`, middleware (request ID, log, recover, security headers) |
| `internal/platform/apperr` | Kiểu lỗi nghiệp vụ `*apperr.Error{Kind, Code, Message}` |
| `internal/platform/clock` | `clock.Func` — giờ hệ thống, inject được trong test |
| `internal/identity` | User, bcrypt, session, CSRF, middleware `RequireAuth` |
| `internal/dojo/rooms` | Room, membership, invite code, `MemberRole` (dùng bởi module khác) |
| `internal/dojo/trials` | Trial, Round (state machine), Decision, Review, replay clock, views |
| `internal/marketdata` | Generator OHLCV giả lập, fingerprint, đọc nến có cutoff |
| `internal/audit` | `Append` (trong tx), `ListForRoom` |
| `internal/idempotency` | `Run` / `Claim` / `Complete` cho `Idempotency-Key` |
| `internal/app` | Ghép service + handler, khai báo route |

### Thay đổi so với cấu trúc đề xuất (và lý do)

1. **`dojo/trials` gộp trials, rounds, replay, decisions, reviews.** Commit, lock, reveal, review cùng khoá các hàng `rounds`/`trials` theo một thứ tự cố định trong một transaction. Tách thành 5 package sẽ tạo vòng import hoặc buộc phải dựng interface chỉ để phá vòng. Một package với nhiều file (`domain.go`, `service.go`, `repository.go`, `views.go`, `handler.go`) dễ đọc hơn.
2. **Không có interface repository.** Repository là hàm nhận `database.Querier` (thoả mãn bởi cả `*sql.DB` và `*sql.Tx`). Test nghiệp vụ chạy trên MariaDB thật, nên chưa cần mock. Khi có use case (ví dụ test service không cần DB) thì mới thêm interface.
3. **Thêm `audit`, `idempotency`, `platform/apperr`, `platform/clock`** — dùng chung bởi nhiều module.
4. **Integration test ở `backend/tests/integration`** (trong Go module để import được `internal/`).
5. **Route:** `POST /rooms/join` (body chứa invite code — người join chưa biết room ID) thay cho `POST /rooms/{id}/join`; thêm `GET /rooms/{id}/trials`, `GET /rooms/{id}/events`.
6. **State machine:** bỏ `PREPARING`, gộp `COMMITTED` vào `REVIEW_BLIND` — xem [mục 8](#8-round-state-machine).

## 4. Core invariants

| # | Invariant | Cơ chế | Test chứng minh |
|---|---|---|---|
| 1 | Một user một decision / round | `UNIQUE uq_decisions_round_user` + map lỗi 1062 → 409 | `TestConcurrentDuplicateDecision` |
| 2 | Không commit sau lock | `SELECT … FOR UPDATE` trên round, kiểm tra `AcceptsDecisions()` | `TestTwoUserDojoFlowSurvivesRestart`, `TestCommitRacingLock` |
| 3 | Không reveal trước điều kiện | `NextStatus` chỉ cho `REVIEW_BLIND → REVEALED`; lock cần ≥1 decision | `TestNextStatus`, `TestTransitionPreconditions` |
| 4 | Clock không lùi | `RevealTarget` dùng `max`; `UPDATE … WHERE clock_index < ?` | `TestRevealTarget`, `TestConcurrentTransitions` |
| 5 | Không lấy nến vượt cutoff | Chỉ `ListCandlesUpTo(…, trial.clock_index)`; handler bỏ qua query param; seed không ra JSON | `TestCandlesNeverExceedServerClock` |
| 6 | Người ngoài không truy cập | `rooms.MemberRole` ở mọi service, trả 404 | `TestOutsiderCannotAccessRoomData` |
| 7 | Retry không tạo bản ghi trùng | Bảng `idempotency_keys`, claim-first trong cùng tx | `TestConcurrentIdempotentDecision`, `TestIdempotentRoomCreate` |
| 8 | Concurrent transition không tạo trạng thái sai | Row lock + `WHERE status = from` + kiểm tra rows affected | `TestConcurrentTransitions` |
| 9 | Không sửa decision sau commit | Không có API update/delete; trigger `BEFORE UPDATE/DELETE` | `TestCommittedDecisionIsImmutable` |
| 10 | Restart không mất trạng thái | Mọi trạng thái trong MariaDB; session lưu DB | `TestTwoUserDojoFlowSurvivesRestart` (phần restart) |

## 5. HTTP request lifecycle

Ví dụ `POST /api/v1/rounds/7/decisions`:

```text
net/http server (cmd/api/main.go)
 └─ httpserver.RequestContext   gán request_id, logger theo request, log 1 dòng khi xong
    └─ httpserver.Recover       panic -> 500 JSON, không sập process
       └─ httpserver.SecurityHeaders
          └─ ServeMux           khớp "POST /api/v1/rounds/{id}/decisions" (internal/app/app.go)
             └─ identity.RequireAuth   cookie -> session (DB) -> user; kiểm tra X-CSRF-Token
                └─ trials.Handler.CommitDecision
                     parse {id}, Idempotency-Key, DecodeJSON (chỉ application/json, cấm field lạ)
                   └─ trials.Service.CommitDecision
                        Normalize + Validate (domain.go)
                        database.WithTx:
                          idempotency.Run -> lockRound FOR UPDATE -> getTrial -> MemberRole
                          -> AcceptsDecisions? -> insertDecision -> audit.Append
                        COMMIT
                   └─ getDecision -> WriteJSON 201
```

Lỗi nghiệp vụ (`*apperr.Error`) được `httpserver.WriteError` chuyển thành status + `{"error":{"code","message"}}`. Lỗi khác: log server-side kèm request_id, client chỉ thấy `INTERNAL` + request_id.

## 6. Transaction boundaries

- `database.WithTx(ctx, db, fn)` mở transaction, commit nếu `fn` trả `nil`, rollback nếu lỗi hoặc panic.
- Nếu MariaDB báo **deadlock (1213)**, `WithTx` chạy lại toàn bộ `fn` (tối đa 3 lần). Vì vậy `fn` chỉ được chạm DB qua `tx`, **không** gọi dịch vụ bên ngoài, không gửi email, không chờ người dùng.
- Isolation mặc định của InnoDB: `REPEATABLE READ`. Các lần đọc cần giá trị mới nhất dùng locking read (`FOR UPDATE`, `LOCK IN SHARE MODE`).
- **Thứ tự khoá cố định** để tránh deadlock: `idempotency key → round → trial → room`. Room bị khoá khi `audit.Append` tăng `rooms.last_event_seq`.
- Mỗi state change và audit event của nó nằm trong **cùng** transaction (`TestTransactionRollbackOnFailure` chứng minh rollback).
- Đọc (GET) không dùng transaction: mỗi câu SELECT tự là một snapshot. Vì trạng thái chỉ đi tiến, một view có thể "cũ" vài mili-giây nhưng không bao giờ lộ thứ chưa được phép.

Mutex trong Go **không** được dùng để bảo vệ dữ liệu: nó chỉ có tác dụng trong một process, còn row lock của InnoDB có tác dụng với mọi process dùng chung database.

## 7. Replay clock ownership

- `trials.clock_index` = chỉ số nến cuối cùng **đã mở**. Nến `seq <= clock_index` được xem; còn lại chỉ nằm trong DB.
- Khởi tạo: `WarmupCandles - 1 = 119` (120 nến warm-up). Mỗi reveal: `+RoundBars (30)`, kẹp ở nến cuối.
- Chỉ `Service.reveal` thay đổi clock, chỉ OWNER gọi được, chỉ từ `REVIEW_BLIND`, và câu `UPDATE` có điều kiện `clock_index < newClock`.
- `GET /trials/{id}/candles` **không nhận tham số cutoff**; mọi query param bị bỏ qua. Không preload dataset tương lai vào browser.
- `datasets.seed` là bí mật: seed + generator tái tạo được toàn bộ tương lai. `Dataset.Seed` có tag `json:"-"`. Seed sinh bằng `crypto/rand`.
- Chỉ có khung M1 (nến đóng hoàn chỉnh), nên không có vấn đề "nến khung lớn đang hình thành".
- Decision lưu `known_at_clock_index`, `known_at_candle_time`, `dataset_fingerprint` do **server** điền.

## 8. Round state machine

```text
                 lock (OWNER, ≥1 decision)      reveal (OWNER)            complete (OWNER)
DECISION_OPEN ───────────────────────────► REVIEW_BLIND ─────────► REVEALED ─────────────► COMPLETED (terminal)
  commit decision                            blind review             outcome visible          → mở round kế tiếp
  (members)                                  (members, không          clock += 30                hoặc trial FINISHED
                                              review chính mình)
```

| Câu hỏi | Trả lời trong v0.1 |
|---|---|
| Ai chuyển trạng thái? | Chỉ OWNER của room (`requireOwner`). Member nhận 403 `OWNER_ONLY`. |
| Điều kiện chuyển? | `lock`: đang `DECISION_OPEN` và có ≥1 decision. `reveal`: đang `REVIEW_BLIND` và còn nến. `complete`: đang `REVEALED`. |
| Terminal? | `COMPLETED` (round) và `FINISHED` (trial). |
| Request lặp? | Nếu round đã ở **đúng** trạng thái đích → 200, không ghi gì, không thêm event. Trạng thái khác → 409 `INVALID_ROUND_TRANSITION`. |
| Concurrent transitions? | `lockRound` (`FOR UPDATE`) tuần tự hoá; request thứ hai thấy trạng thái mới và trở thành no-op. `UPDATE … WHERE status = from` là lớp bảo vệ thứ hai. |
| Thành viên chưa gửi quyết định? | Hiển thị "no decision"; sau lock không thể gửi (409 `ROUND_ALREADY_LOCKED`). Không phạt, không tự điền. |
| Owner ngắt kết nối? | Không có gì hết hạn. Trạng thái nằm trong DB; owner đăng nhập lại và tiếp tục. Chưa có chuyển quyền owner (technical debt). |
| Frontend có quyết định trạng thái? | Không. UI chỉ hiển thị nút hợp lệ theo `round.status` server trả về; server kiểm tra lại mọi thứ. |

**Vì sao khác đề xuất:** `PREPARING` không có hành động nào trong v0.1 (round được tạo và mở trong cùng transaction), nên một trạng thái không quan sát được chỉ gây nhầm. `COMMITTED` và `REVIEW_BLIND` không có hành động nào giữa chúng, nên gộp: hành động `lock` đưa round vào `REVIEW_BLIND` và ghi event `ROUND_LOCKED`. Khi có "chuẩn bị round" (chọn độ dài reveal, timer) thì thêm `PREPARING` bằng migration mới + ADR.

Trial: `CREATED → RUNNING → FINISHED`. Một room chỉ có tối đa **một** trial chưa `FINISHED` (cột sinh `active_room_id` + `UNIQUE`). Mỗi trial có 16 round (`(600-120)/30`).

## 9. Authentication

- Mật khẩu: bcrypt cost 12 (cấu hình `MF_BCRYPT_COST`), 10–72 byte (bcrypt chỉ dùng 72 byte đầu nên từ chối dài hơn thay vì cắt ngầm).
- Login sai user hay sai mật khẩu đều trả `INVALID_CREDENTIALS`; khi user không tồn tại vẫn so bcrypt với một hash giả để thời gian phản hồi tương đương.
- Session: token 32 byte ngẫu nhiên (`crypto/rand`) trong cookie `mf_session` — `HttpOnly`, `SameSite=Lax`, `Secure` khi `MF_COOKIE_SECURE=true`, `Path=/api/`. DB chỉ lưu **SHA-256(token)**.
- Hết hạn: `expires_at` (mặc định 7 ngày). Logout đặt `revoked_at`.
- CSRF: mỗi session có `csrf_token`; mọi method không an toàn (POST…) phải gửi header `X-CSRF-Token` khớp (so sánh constant-time). Thêm vào đó: body bắt buộc `application/json` (form HTML cross-site không gửi được), và `SameSite=Lax`.
- User ID **luôn** lấy từ session. Body chứa `user_id`/`owner_id` bị từ chối vì `DisallowUnknownFields`.

## 10. Database design

| Bảng | Khoá / constraint chính | Index |
|---|---|---|
| `users` | PK `id`, `UNIQUE username` | |
| `sessions` | PK `token_hash`, FK user | `user_id`, `expires_at` |
| `rooms` | PK, `UNIQUE invite_code`, FK owner | `owner_id` |
| `room_members` | PK `(room_id, user_id)`, FK | `user_id` |
| `datasets` | PK, `UNIQUE fingerprint` | |
| `candles` | PK `(dataset_id, seq)`, `CHECK` OHLC hợp lệ, FK | |
| `trials` | PK, FK, `UNIQUE active_room_id` (cột sinh) | `room_id` |
| `rounds` | PK, `UNIQUE (trial_id, round_no)`, `UNIQUE open_trial_id` (cột sinh) | |
| `decisions` | PK, `UNIQUE (round_id, user_id)`, `CHECK confidence 1..5`, trigger chặn UPDATE/DELETE | `user_id` |
| `reviews` | PK, `UNIQUE (decision_id, reviewer_id)` | `round_id` |
| `audit_events` | PK, `UNIQUE (room_id, sequence)`, `payload JSON`, trigger chặn UPDATE/DELETE | |
| `idempotency_keys` | PK `(user_id, operation, idem_key)` | |
| `schema_migrations` | PK `version`, checksum | |

- Giá lưu dạng **BIGINT ticks** + `price_scale` (giá = ticks / 10^scale). Không dùng FLOAT/DOUBLE.
- Thời gian: `DATETIME(6)` UTC. Kết nối ép `time_zone='+00:00'`, `parseTime=true`, `loc=UTC` (`database.NormalizeDSN`).
- Mẹo "cột sinh + UNIQUE": `active_room_id = IF(status chưa xong, room_id, NULL)`. UNIQUE bỏ qua NULL, nên ràng buộc "tối đa một trial đang chạy mỗi phòng" được DB bảo vệ, kể cả khi hai request chạy song song.

## 11. Idempotency

`internal/idempotency/idempotency.go`. Áp dụng cho: tạo room, tạo trial, commit decision, submit review. Join room tự idempotent (đã là member → 200).

1. Bắt đầu transaction nghiệp vụ, `INSERT` key (claim) với `request_hash = SHA-256(path IDs + body)`.
2. Nếu key đã tồn tại và đã commit: lỗi 1062 → đọc `LOCK IN SHARE MODE` → hash khớp thì trả kết quả cũ (`Idempotent-Replayed: true`), không khớp thì 409 `IDEMPOTENCY_KEY_REUSED`.
3. Nếu transaction khác đang giữ key chưa commit: `INSERT` của ta **chờ** row lock, rồi thấy kết quả của nó.
4. Làm việc nghiệp vụ, ghi `result_id`, commit — tất cả cùng một transaction.

Chỉ kết quả thành công được lưu; lỗi nghiệp vụ rollback cả claim, retry sẽ chạy lại. Chưa có job dọn key cũ (technical debt).

## 12. Audit events

- `audit.Append(ctx, tx, …)` nhận `*sql.Tx` — bắt buộc gọi trong transaction của thay đổi trạng thái.
- Aggregate là **room**; `sequence` tăng liên tục, không khe hở, nhờ `UPDATE rooms SET last_event_seq = last_event_seq + 1` (khoá hàng room).
- Payload không chứa bí mật hay nội dung đang niêm phong (ví dụ `DECISION_COMMITTED` chỉ có `round_id`, không có direction/thesis; `ROOM_CREATED` không có invite code).
- Append-only ở application level + trigger DB. **Không phải tamper-proof**: DBA vẫn có thể xoá trigger. Hash-chain nằm ở roadmap.

## 13. Security boundaries

| Ranh giới | Bảo vệ |
|---|---|
| Browser ↔ API | Cookie HttpOnly/SameSite, CSRF header, JSON-only body, giới hạn body 64 KiB, security headers, `Cache-Control: no-store` |
| User ↔ dữ liệu phòng | `MemberRole` trong mọi service; 404 cho người ngoài |
| Member ↔ quyền owner | `requireOwner` cho start/lock/reveal/complete/create trial |
| Player ↔ tương lai | Clock do server giữ, seed bí mật, không cutoff từ client |
| Lỗi ↔ client | Không trả stack trace/SQL/secret; log server có request_id |
| Code ↔ SQL | Placeholder `?` ở mọi nơi; tên cột động chỉ từ `switch` cố định |
| Local ↔ mạng | Compose bind cổng vào `127.0.0.1`; Vite chỉ nghe localhost |

Khi deploy thật (chưa thuộc v0.1): HTTPS bắt buộc, `MF_COOKIE_SECURE=true`, rate limit login, secret quản lý ngoài repo.

## 14. Khôi phục trạng thái & tái lập

- **Restart:** API không giữ trạng thái nghiệp vụ trong bộ nhớ. Dừng/khởi động lại → đọc lại từ DB: clock, round, decision, review, session. `TestTwoUserDojoFlowSurvivesRestart` dừng một instance và khởi động instance mới với pool mới, dùng lại cookie cũ.
- **Shutdown an toàn:** `SIGTERM`/Ctrl+C → `srv.Shutdown` chờ request đang chạy (tối đa 10s); transaction đang dở sẽ commit hoặc rollback, không có trạng thái nửa vời.
- **Tái lập dữ liệu:** cùng `(seed, start_time, count, initial_price, generator_version)` → cùng nến, cùng fingerprint (`TestGenerateIsDeterministic`, `TestGenerateGoldenFingerprint`). Generator dùng SplitMix64 tự viết, không phụ thuộc phiên bản Go.
- **Tái lập phiên:** trạng thái logic của trial = dataset (fingerprint) + `engine_version` + chuỗi audit event theo `sequence`. v0.1 *lưu đủ* dữ liệu để tái dựng nhưng chưa có công cụ "replay từ event log" — đó là roadmap (event sourcing đầy đủ chưa cần).

## 15. Technical debt

| Vấn đề | Tác động | Lý do chưa làm | Rủi ro | Hướng giải quyết | Ưu tiên |
|---|---|---|---|---|---|
| Chưa có rate limit login | Brute-force mật khẩu | Ngoài scope local dev | Cao khi public | Bảng đếm theo IP/username hoặc middleware token bucket | Cao trước khi deploy |
| Không chuyển quyền OWNER | Owner vắng → phòng đứng | Giữ state machine đơn giản | Thấp (nhóm nhỏ) | Endpoint transfer + audit event + ADR | Trung bình |
| Không dọn session/idempotency key cũ | Bảng lớn dần | Tải rất nhỏ | Thấp | Job dọn theo `expires_at`/`created_at` | Thấp |
| `TestCommitRacingLock` mang tính xác suất | Có thể không bắt được regression về lock | Race test khó tất định | Trung bình | Thêm hook test để dừng giữa lock và insert | Trung bình |
| Docker Compose chưa chạy thử trên máy bootstrap | Có thể có lỗi cấu hình | Máy không có Docker | Trung bình | Chạy `docker compose up --build` và sửa | Cao (việc đầu tiên) |
| UI chưa có test component/e2e | Lỗi UI không bị CI bắt | Ưu tiên invariant backend | Thấp | Vitest + Testing Library, sau đó Playwright | Trung bình |
| Polling 3s | Tải nhẹ dư thừa, trễ ≤3s | ADR-005 | Thấp | SSE/WebSocket khi đo được nhu cầu | Thấp |
| Migration không nguyên tử (DDL MariaDB) | Migration lỗi giữa chừng cần sửa tay | Giới hạn của MariaDB | Thấp | Giữ file nhỏ; test migration trong CI | Thấp |
| Chưa có `govulncheck`/dependency audit trong CI | Không biết CVE dependency | Giữ CI tối thiểu | Trung bình | Thêm job `govulncheck` + `npm audit` | Trung bình |
