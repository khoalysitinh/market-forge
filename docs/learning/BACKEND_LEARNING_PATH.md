# Backend Learning Path — học Go từ chính MARKET FORGE

Dành cho người đã vững SQL/MariaDB, Linux, đọc log, debug API — và đang học Go + kiến trúc backend.

**Cách dùng:** mỗi bài ~1–2 buổi. Đọc file được chỉ định *trước*, rồi mới đọc giải thích. Làm bài tập trên một nhánh riêng (`git switch -c learn/bai-01`), chạy lệnh kiểm chứng, rồi `git switch main` (hoặc giữ lại nếu đáng merge).

Lệnh dùng xuyên suốt (từ thư mục `backend/`):

```bash
go build ./...                 # có biên dịch được không
go vet ./...                   # lỗi hay gặp mà compiler bỏ qua
go test -count=1 ./...         # unit test
go test -tags=integration -count=1 ./tests/integration/...   # cần MF_TEST_DATABASE_DSN
```

---

## Bài 1 — Entrypoint của một ứng dụng Go

**Mục tiêu:** hiểu chương trình bắt đầu từ đâu, cấu hình vào bằng cách nào, dừng thế nào cho an toàn.

**Đọc:** [backend/cmd/api/main.go](../../backend/cmd/api/main.go) (`main`, `run`), [internal/platform/config/config.go](../../backend/internal/platform/config/config.go) (`Load`).

**Khái niệm:**
- `package main` + `func main()` là điểm vào. Ở đây `main` chỉ gọi `run()` và đổi lỗi thành exit code 1 — nhờ vậy `run` có thể dùng `return err` và `defer` bình thường (`os.Exit` bỏ qua defer).
- Cấu hình đến từ **biến môi trường** (12-factor), không hardcode. `MF_DATABASE_DSN` bắt buộc; còn lại có mặc định.
- `signal.NotifyContext` tạo một `context` bị huỷ khi nhận Ctrl+C/SIGTERM. `srv.Shutdown` chờ request đang chạy xong.

**Ví dụ trong project:** thứ tự trong `run()`: config → logger → context tín hiệu → mở DB → `app.NewHandler` → `http.Server` có timeout → chạy `ListenAndServe` trong goroutine → `select` chờ lỗi hoặc tín hiệu.

**Câu hỏi kiểm tra:**
1. Nếu thay `return err` trong `run()` bằng `os.Exit(1)`, `db.Close()` có còn chạy không? Vì sao?
2. `ReadHeaderTimeout` bảo vệ server khỏi kiểu tấn công nào?
3. Tại sao `ListenAndServe` chạy trong goroutine riêng?

**Bài tập:** log thêm phiên bản Go khi khởi động (`runtime.Version()`) trong dòng `"api listening"`.

**Tự kiểm chứng:** `go run ./cmd/api` → thấy trường `go_version` trong log JSON. Nhấn Ctrl+C → thấy `"shutting down"`.

---

## Bài 2 — Struct và method

**Mục tiêu:** đọc/viết kiểu dữ liệu nghiệp vụ và hành vi gắn với nó.

**Đọc:** [internal/dojo/trials/domain.go](../../backend/internal/dojo/trials/domain.go): `Trial`, `Round`, `RoundStatus` và các method `AcceptsDecisions`, `AcceptsReviews`, `DecisionsUnsealed`, `OutcomeVisible`.

**Khái niệm:**
- `struct` gom field; tag `json:"..."` quyết định tên khi mã hoá JSON.
- Method là hàm có *receiver*: `func (s RoundStatus) AcceptsDecisions() bool`. Kiểu nào cũng có method được, kể cả `string` đặt tên lại (`type RoundStatus string`).
- Gắn luật vào kiểu ("trạng thái này có nhận decision không") giúp service đọc như câu tiếng Anh: `if !r.Status.AcceptsDecisions()`.

**Ví dụ:** `Service.CommitDecision` ([service.go](../../backend/internal/dojo/trials/service.go)) không tự so sánh chuỗi `"DECISION_OPEN"` mà hỏi `r.Status.AcceptsDecisions()`.

**Câu hỏi kiểm tra:**
1. Vì sao `RoundStatus` là kiểu riêng thay vì `string` trần?
2. Hãy nêu 2 chỗ khác trong code dùng `OutcomeVisible()`/`DecisionsUnsealed()`.

**Bài tập:** thêm `func (s RoundStatus) IsTerminal() bool` (chỉ `COMPLETED` là true) và một test trong [domain_test.go](../../backend/internal/dojo/trials/domain_test.go) kiểm tra cả 4 trạng thái.

**Tự kiểm chứng:** `go test ./internal/dojo/trials/ -run IsTerminal -v`.

---

## Bài 3 — Pointer và value

**Mục tiêu:** biết khi nào dùng `*T` và khi nào dùng `T`.

**Đọc:** `DecisionInput.Normalize` (receiver `*DecisionInput`) và `DecisionInput.Validate` (receiver `DecisionInput`) trong [domain.go](../../backend/internal/dojo/trials/domain.go); `Round.RevealClockIndex *int`; `type Service struct` + `func (s *Service) ...`.

**Khái niệm:**
- Value receiver nhận **bản sao**: sửa bên trong không ảnh hưởng bên ngoài. Pointer receiver sửa được bản gốc.
- `Normalize` *cần* sửa input → pointer. `Validate` chỉ đọc → value là đủ.
- Pointer còn dùng để biểu diễn "không có giá trị": `RevealClockIndex *int` là `nil` (JSON `null`) cho đến khi reveal — khác với `0`.
- Service dùng pointer receiver để mọi handler dùng chung một instance (chứa `*sql.DB`), không copy.

**Câu hỏi kiểm tra:**
1. `nullTimePtr` trong [trials/repository.go](../../backend/internal/dojo/trials/repository.go) làm gì, và vì sao trả `*time.Time`?
2. Nếu `RevealClockIndex` là `int`, frontend phân biệt "chưa reveal" với "reveal tới nến 0" bằng cách nào?

**Bài tập:** tạm đổi `func (in *DecisionInput) Normalize()` thành `func (in DecisionInput) Normalize()`. Chạy test. Giải thích vì sao case `"lowercase direction is normalized"` hỏng. Đổi lại.

**Tự kiểm chứng:** `go test ./internal/dojo/trials/ -run TestDecisionValidate -v` fail khi đổi, pass khi trả lại.

---

## Bài 4 — Interface

**Mục tiêu:** hiểu interface của Go là *ngầm định* và dùng nó để viết code linh hoạt.

**Đọc:** `type Querier interface` trong [platform/database/database.go](../../backend/internal/platform/database/database.go); cách repository nhận `q database.Querier`; `func (e *Error) Error() string` trong [apperr.go](../../backend/internal/platform/apperr/apperr.go).

**Khái niệm:**
- Một kiểu thoả mãn interface chỉ cần **có đủ method** — không cần `implements`. `*sql.DB` và `*sql.Tx` đều có `ExecContext/QueryContext/QueryRowContext` → đều là `Querier`.
- Nhờ vậy cùng một hàm `rooms.MemberRole(ctx, q, ...)` chạy được trong transaction (truyền `tx`) và ngoài transaction (truyền `s.db`).
- `error` cũng là interface (`Error() string`). `*apperr.Error` là một error.
- Nguyên tắc: interface nhỏ, đặt ở nơi *dùng*, chỉ tạo khi có ≥2 cài đặt hoặc cần test. Project chưa có interface repository vì chưa cần (xem ARCHITECTURE §3).

**Câu hỏi kiểm tra:**
1. Tìm một chỗ gọi `MemberRole` với `tx` và một chỗ với `s.db`. Vì sao mỗi chỗ chọn như vậy?
2. `http.Handler` là interface gồm method nào? `http.HandlerFunc` thoả mãn nó ra sao?

**Bài tập:** viết `func countMembers(ctx context.Context, q database.Querier, roomID int64) (int, error)` trong package `rooms` và gọi nó từ một test (integration) với cả `e.db` và một `tx`.

**Tự kiểm chứng:** `go vet -tags=integration ./...` biên dịch được; test pass.

---

## Bài 5 — HTTP request lifecycle

**Mục tiêu:** lần theo một request từ socket đến response.

**Đọc:** [internal/app/app.go](../../backend/internal/app/app.go) (`NewHandler`), [platform/httpserver/middleware.go](../../backend/internal/platform/httpserver/middleware.go) (`Chain`, `RequestContext`, `Recover`), [ARCHITECTURE §5](../architecture/ARCHITECTURE.md#5-http-request-lifecycle).

**Khái niệm:**
- Go 1.22+ `ServeMux` hỗ trợ pattern `"POST /api/v1/rounds/{id}/lock"`; lấy tham số bằng `r.PathValue("id")`.
- Middleware là hàm `func(http.Handler) http.Handler` — bọc handler để làm việc trước/sau (log, recover, auth).
- `context.Context` mang request ID, logger, user đã xác thực, và tín hiệu huỷ khi client ngắt.

**Câu hỏi kiểm tra:**
1. Thứ tự middleware trong `Chain(mux, RequestContext, Recover, SecurityHeaders)` — cái nào chạy trước?
2. Route `/api/` cuối cùng để làm gì?
3. Vì sao `RequireAuth` bọc từng route thay vì bọc toàn bộ mux?

**Bài tập:** thêm `GET /api/v1/version` (không cần auth) trả `{"engine_version": trials.EngineVersion, "generator_version": marketdata.GeneratorVersion}`. Cập nhật [docs/api/API.md](../api/API.md).

**Tự kiểm chứng:** `curl -i http://127.0.0.1:8080/api/v1/version` → `200`, có header `X-Request-ID`; log API có một dòng `"http request"` với `path=/api/v1/version`.

---

## Bài 6 — JSON decoding/encoding

**Mục tiêu:** nhận input an toàn, trả output đúng hợp đồng.

**Đọc:** `DecodeJSON`, `WriteJSON` trong [httpserver/respond.go](../../backend/internal/platform/httpserver/respond.go); test [respond_test.go](../../backend/internal/platform/httpserver/respond_test.go); `Dataset.Seed` với tag `json:"-"` trong [marketdata/repository.go](../../backend/internal/marketdata/repository.go).

**Khái niệm:**
- `json.NewDecoder(r.Body).Decode(&dst)` điền struct theo tag.
- `DisallowUnknownFields()`: body có `"user_id": 1` bị từ chối thay vì bị lờ đi — chặn người dùng "gửi kèm" field mong được tin.
- `http.MaxBytesReader` giới hạn kích thước body; decode thêm lần nữa để chắc không có dữ liệu thừa.
- `json:"-"` = không bao giờ xuất field ra JSON (seed bí mật).

**Câu hỏi kiểm tra:**
1. Điều gì xảy ra nếu bỏ `DisallowUnknownFields` và client gửi `{"name":"x","owner_id":1}` tới `POST /rooms`? Có nguy hiểm không với code hiện tại?
2. Vì sao yêu cầu `Content-Type: application/json` lại giúp chống CSRF?

**Bài tập:** thêm một case vào `TestDecodeJSON`: body `[]` (mảng JSON) phải bị từ chối với `INVALID_JSON`.

**Tự kiểm chứng:** `go test ./internal/platform/httpserver/ -v -run TestDecodeJSON`.

---

## Bài 7 — Handler → Service → Repository

**Mục tiêu:** biết mỗi tầng chịu trách nhiệm gì.

**Đọc theo thứ tự:** `Handler.CommitDecision` ([trials/handler.go](../../backend/internal/dojo/trials/handler.go)) → `Service.CommitDecision` ([service.go](../../backend/internal/dojo/trials/service.go)) → `lockRound`, `insertDecision` ([repository.go](../../backend/internal/dojo/trials/repository.go)).

**Khái niệm:**
- **Handler:** parse path/header/body, lấy user từ context, gọi service, ghi response. Không SQL, không luật nghiệp vụ.
- **Service:** use case — validate, transaction, kiểm tra quyền + trạng thái, gọi repository, ghi audit.
- **Repository:** SQL thuần, nhận `Querier`/`*sql.Tx`, trả struct hoặc lỗi.
- **Domain** (`domain.go`): kiểu, state machine, validation — không phụ thuộc DB/HTTP nên test nhanh.

**Câu hỏi kiểm tra:**
1. Kiểm tra membership nằm ở tầng nào? Nếu đặt ở handler thì chuyện gì xảy ra với `cmd/demo` hay một job nền gọi service trực tiếp?
2. Vì sao `insertDecision` trả nguyên lỗi DB còn service mới đổi 1062 thành `ErrDecisionExists`?

**Bài tập:** vẽ (giấy hoặc Mermaid) sơ đồ gọi hàm của `POST /rounds/{id}/lock` đến tận câu SQL `UPDATE rounds ...`. Ghi tên file cho mỗi bước.

**Tự kiểm chứng:** so với [ARCHITECTURE §5](../architecture/ARCHITECTURE.md#5-http-request-lifecycle); đặt breakpoint (VS Code Go debugger) trong `Service.lock` và gọi API.

---

## Bài 8 — Kết nối database

**Mục tiêu:** hiểu connection pool và các tham số kết nối.

**Đọc:** `Open`, `NormalizeDSN` trong [database.go](../../backend/internal/platform/database/database.go).

**Khái niệm:**
- `sql.Open` **không** kết nối ngay; `PingContext` mới kiểm tra thật.
- `*sql.DB` là một **pool**, an toàn dùng đồng thời; tạo một lần, dùng chung.
- `parseTime=true` để `DATETIME` → `time.Time`; `loc=UTC` + `time_zone='+00:00'` để mọi thời gian là UTC ở cả client lẫn server.
- `multiStatements` chỉ bật cho migration — tắt với app để giảm thiệt hại nếu có SQL injection.

**Câu hỏi kiểm tra:**
1. Điều gì xảy ra nếu MariaDB server có `time_zone=+07:00` mà ta không ép `+00:00`?
2. `SetMaxOpenConns(20)` có ý nghĩa gì khi 50 request đến cùng lúc?

**Bài tập:** viết `TestNormalizeDSN` (unit test, package `database`) kiểm tra DSN đầu ra chứa `parseTime=true`, `loc=UTC`, `time_zone=` và **không** chứa `multiStatements=true` khi `Options{}`.

**Tự kiểm chứng:** `go test ./internal/platform/database/ -v`.

---

## Bài 9 — SQL transaction

**Mục tiêu:** biết transaction bảo vệ invariant thế nào, và vì sao thứ tự khoá quan trọng.

**Đọc:** `WithTx`, `runTx` trong [database.go](../../backend/internal/platform/database/database.go); `lockRound`, `lockTrial` trong [trials/repository.go](../../backend/internal/dojo/trials/repository.go); `Service.reveal`; [ARCHITECTURE §6](../architecture/ARCHITECTURE.md#6-transaction-boundaries).

**Khái niệm:**
- `SELECT ... FOR UPDATE` khoá hàng tới khi `COMMIT/ROLLBACK`; transaction khác muốn khoá cùng hàng phải **chờ**.
- `defer` + biến `err` có tên → rollback tự động khi có lỗi hoặc panic.
- Deadlock: hai transaction khoá A rồi B và B rồi A. Phòng tránh bằng thứ tự khoá cố định (round → trial → room); nếu vẫn xảy ra, `WithTx` chạy lại.
- Mutex Go chỉ khoá trong một process; row lock khoá cho mọi process.

**Câu hỏi kiểm tra:**
1. Vì sao `fn` trong `WithTx` không được gửi HTTP request ra ngoài?
2. `updateRoundStatus` có `WHERE status = ?` dù đã khoá hàng — bảo vệ thêm được gì?

**Bài tập (thực hành bằng SQL — thế mạnh của bạn):** mở **hai** phiên `mariadb` vào DB dev.
```sql
-- Phiên 1
BEGIN; SELECT id, status FROM rounds WHERE id = 1 FOR UPDATE;
-- Phiên 2
BEGIN; SELECT id, status FROM rounds WHERE id = 1 FOR UPDATE;   -- treo
-- Phiên 1
COMMIT;                                                          -- phiên 2 chạy tiếp
-- Phiên 2
ROLLBACK;
```
Trong lúc phiên 2 đang treo, thử gọi `POST /rounds/1/lock` từ API — nó cũng phải chờ.

**Tự kiểm chứng:** quan sát thời gian chờ; `SHOW ENGINE INNODB STATUS\G` (mục TRANSACTIONS) thấy lock wait.

---

## Bài 10 — Error handling

**Mục tiêu:** phân biệt lỗi nghiệp vụ và lỗi hệ thống; không bao giờ để lộ chi tiết nội bộ.

**Đọc:** [apperr.go](../../backend/internal/platform/apperr/apperr.go); `WriteError`, `statusFor` trong [respond.go](../../backend/internal/platform/httpserver/respond.go); danh sách `Err...` cuối [domain.go](../../backend/internal/dojo/trials/domain.go).

**Khái niệm:**
- Lỗi nghiệp vụ: `*apperr.Error{Kind, Code, Message}`. `Kind` → HTTP status, `Code` → hợp đồng API ổn định, `Message` → cho người đọc.
- Lỗi khác: bọc bằng `fmt.Errorf("context: %w", err)` để giữ chuỗi nguyên nhân; `errors.As/Is` để kiểm tra.
- `WriteError` log lỗi hệ thống kèm request_id, client chỉ thấy `INTERNAL`.
- Không "nuốt" lỗi: `_ = x` chỉ khi có lý do ghi rõ.

**Câu hỏi kiểm tra:**
1. Vì sao test kiểm tra `errorCode()` chứ không kiểm tra `message`?
2. `hideOutsider` trong [service.go](../../backend/internal/dojo/trials/service.go) đổi lỗi gì thành gì, và vì sao?

**Bài tập:** đổi `Message` của `ErrRoundLocked` sang tiếng Việt. Chạy toàn bộ test. Có test nào hỏng không? Giải thích vì sao đó là thiết kế tốt.

**Tự kiểm chứng:** `go test ./... && go test -tags=integration ./tests/integration/...` vẫn xanh; `curl` thấy message mới.

---

## Bài 11 — Authentication

**Mục tiêu:** hiểu session phía server, cookie và CSRF.

**Đọc:** [identity/service.go](../../backend/internal/identity/service.go) (`Login`, `Authenticate`, `hashToken`), [identity/handler.go](../../backend/internal/identity/handler.go) (`Login` set cookie, `RequireAuth`), [migrations/0001_identity.sql](../../backend/migrations/0001_identity.sql).

**Khái niệm:**
- bcrypt: hash chậm có salt, chống dò mật khẩu khi lộ DB.
- Session token ngẫu nhiên 256 bit; DB chỉ lưu SHA-256 → dump DB không dùng làm cookie được.
- Cookie `HttpOnly` (JS không đọc), `SameSite=Lax`, `Secure` (HTTPS).
- CSRF: trang độc hại có thể làm browser *gửi* cookie, nhưng không *đọc* được `csrf_token` → không có header đúng → 403.

**Câu hỏi kiểm tra:**
1. Vì sao login sai user và sai mật khẩu trả cùng một mã lỗi?
2. Logout làm gì ở DB? Cookie cũ sau logout bị từ chối ở câu SQL nào?

**Bài tập (curl + SQL):** đăng nhập bằng curl (xem cuối [API.md](../api/API.md)), rồi:
- gửi `POST /rooms` **không** có `X-CSRF-Token` → phải là 403;
- `SELECT token_hash, expires_at, revoked_at FROM sessions ORDER BY created_at DESC LIMIT 1;` — so sánh với giá trị cookie trong file `jar`: chúng khác nhau. Tính `printf '%s' '<cookie>' | sha256sum` → bằng `token_hash`.

**Tự kiểm chứng:** kết quả như trên; `TestSessionAndCSRF` pass.

---

## Bài 12 — Testing

**Mục tiêu:** viết test bảo vệ hành vi, không chỉ tăng số lượng.

**Đọc:** `TestNextStatus` ([domain_test.go](../../backend/internal/dojo/trials/domain_test.go)) — table-driven; [tests/integration/harness_test.go](../../backend/tests/integration/harness_test.go) (`TestMain`, `startEnv`, `newUser`); [flow_test.go](../../backend/tests/integration/flow_test.go).

**Khái niệm:**
- Table-driven test: một slice các case, một vòng lặp, `t.Run(name, ...)`.
- Unit test (không DB, nhanh) cho domain; integration test (MariaDB thật) cho transaction, constraint, concurrency.
- Build tag `//go:build integration` tách hai loại.
- An toàn: harness chỉ chạy trên DB tên `*_test`.
- **Mutation testing thủ công:** cố ý làm hỏng code, xem test có bắt được không. Test không fail khi code hỏng là test vô dụng.

**Câu hỏi kiểm tra:**
1. `startEnv` được gọi hai lần trong `TestTwoUserDojoFlowSurvivesRestart` — mô phỏng điều gì?
2. Vì sao seed trong test là số tăng dần thay vì `crypto/rand`?

**Bài tập:** trong `Service.lock`, tạm comment khối `if n == 0 { return ErrNoDecisions }`. Chạy integration test. Ghi lại test nào fail và thông báo lỗi. Trả lại code.

**Tự kiểm chứng:** `TestTransitionPreconditions` fail khi bỏ khối đó, pass khi trả lại.

---

## Bài 13 — Concurrency basics

**Mục tiêu:** goroutine, WaitGroup, channel — và vì sao đúng đắn khi đồng thời là việc của database.

**Đọc:** `fire` trong [concurrency_test.go](../../backend/tests/integration/concurrency_test.go); `TestConcurrentDuplicateDecision`, `TestConcurrentTransitions`.

**Khái niệm:**
- `go f()` chạy `f` đồng thời. `sync.WaitGroup` chờ tất cả xong.
- `close(start)` mở "cổng" cho mọi goroutine cùng lúc — tăng xác suất va chạm thật.
- Data race: hai goroutine cùng ghi một biến không đồng bộ. `go test -race` phát hiện (cần gcc; CI Linux chạy).
- `t.Fatal` chỉ gọi từ goroutine của test (xem chú thích trong `TestCommitRacingLock`).
- HTTP server Go xử lý mỗi request trong một goroutine → service phải an toàn đồng thời → không giữ trạng thái nghiệp vụ trong biến Go.

**Câu hỏi kiểm tra:**
1. Trong `TestConcurrentDuplicateDecision`, cơ chế nào đảm bảo chỉ 1 request thành công? (Có *hai* lớp — nêu cả hai.)
2. Vì sao `TestCommitRacingLock` có thể pass ngay cả khi bỏ `FOR UPDATE`? (Gợi ý: technical debt trong ARCHITECTURE §15.)

**Bài tập:** đổi `parallel` thành 50, chạy `go test -tags=integration -run Concurrent -count=3 ./tests/integration/...`. Đo thời gian. Giải thích vì sao tăng gấp 5 số request mà kết quả vẫn đúng.

**Tự kiểm chứng:** test pass ổn định qua 3 lần chạy.

---

## Bài 14 — Idempotency

**Mục tiêu:** làm cho "retry" an toàn.

**Đọc:** [internal/idempotency/idempotency.go](../../backend/internal/idempotency/idempotency.go) (`Run`, `Claim`); cách `rooms.Service.Create` dùng nó; [ARCHITECTURE §11](../architecture/ARCHITECTURE.md#11-idempotency).

**Khái niệm:**
- Mạng chập chờn: client không biết request đã thành công hay chưa → gửi lại. Không có idempotency → tạo trùng.
- Claim-first: INSERT key **đầu** transaction. Request thứ hai cùng key bị **chặn bởi row lock** cho đến khi request đầu xong.
- Hash của request: cùng key mà khác nội dung là lỗi của client → 409.
- Không dùng map trong bộ nhớ: restart là mất, nhiều instance không thấy nhau.

**Câu hỏi kiểm tra:**
1. Vì sao lỗi nghiệp vụ (ví dụ round đã khoá) **không** được lưu vào `idempotency_keys`?
2. Join room không dùng `Idempotency-Key` — vì sao nó vẫn an toàn khi retry?

**Bài tập (curl):** gửi `POST /rooms` hai lần với cùng `Idempotency-Key: learn-14` và cùng body → cùng `room.id`, lần 2 có header `Idempotent-Replayed: true`. Lần 3 đổi `name` → 409. Xem `SELECT * FROM idempotency_keys WHERE idem_key='learn-14';`.

**Tự kiểm chứng:** như trên; `TestIdempotentRoomCreate`, `TestConcurrentIdempotentDecision` pass.

---

## Bài 15 — Server-owned state

**Mục tiêu:** hiểu vì sao server — không phải browser — là nguồn sự thật.

**Đọc:** [ADR-003](../adr/ADR-003-server-authoritative-replay-clock.md); `Service.Candles`, `Service.GetRound` trong [views.go](../../backend/internal/dojo/trials/views.go); `Service.reveal`; `CryptoSeed`.

**Khái niệm:**
- Mọi thứ browser gửi đều có thể bị sửa (DevTools, curl). Server phải tự biết: user là ai (session), giờ replay là mấy (`clock_index`), round đang ở đâu (`status`), ai được xem gì (views).
- "Sealed" là quy tắc **ở server**: trong `DECISION_OPEN`, `GetRound` không đưa decision của người khác vào response — UI có bug cũng không lộ được.
- Bí mật phái sinh: seed tự nó không phải giá, nhưng tái tạo được giá → cũng phải giữ kín.

**Câu hỏi kiểm tra:**
1. Liệt kê mọi field trong `DecisionInput`. Vì sao không có `user_id`, `clock_index`, `committed_at`?
2. Payload của event `DECISION_COMMITTED` chứa gì? Nếu thêm `direction` vào payload thì vi phạm pillar nào?

**Bài tập:** viết integration test `TestTrialResponseHasNoSeed`: tạo trial, gọi `GET /trials/{id}` và `GET /trials/{id}/candles`, assert body (chuỗi thô) **không** chứa `"seed"`. Sau đó thử tạm xoá tag `json:"-"` của `Dataset.Seed` để chắc chắn test của bạn fail.

**Tự kiểm chứng:** test fail khi xoá tag, pass khi có tag.

---

## Sau 15 bài

Bạn sẽ đọc được toàn bộ backend. Bước tiếp: chọn issue dễ nhất trong [OWNER_HANDOFF.md](OWNER_HANDOFF.md#10-github-issues-đề-xuất) và tự làm từ đầu đến PR, có test.
