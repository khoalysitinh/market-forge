# OWNER HANDOFF — MARKET FORGE v0.1 Foundation

Gửi Khoa. Tài liệu này nói thẳng: cái gì đã có, cái gì đã được **chạy thật để kiểm chứng**, cái gì chưa, và nên bắt đầu học từ đâu.

## 1. Hệ thống đã có gì

- Go API (một binary) với 22 endpoint: auth, rooms, trials, rounds, decisions, reviews, audit timeline, health/ready.
- MariaDB schema qua 6 migration: 12 bảng nghiệp vụ + `schema_migrations`, constraint/index/trigger bảo vệ invariant.
- Dữ liệu giả lập M1 deterministic (SplitMix64, giá số nguyên, fingerprint SHA-256), nhãn `SYNTHETIC MARKET DATA — NOT REAL NAS100`.
- Replay clock do server giữ; vòng `DECISION_OPEN → REVIEW_BLIND → REVEALED → COMPLETED`; 16 round mỗi trial.
- Idempotency-Key lưu DB; audit log append-only cùng transaction.
- Frontend React tối thiểu chạy trọn luồng; `cmd/demo` chơi một round với 2 user.
- Unit + integration test; GitHub Actions CI; Docker Compose; tài liệu kiến trúc, 5 ADR, API, learning path.

## 2. Đã kiểm chứng thế nào (trên máy bootstrap, Windows 10)

| Hạng mục | Lệnh | Kết quả |
|---|---|---|
| Build + vet | `go build ./... && go vet ./... && go vet -tags=integration ./...` | sạch |
| Format | `gofmt -l .` | rỗng |
| Unit test backend | `go test -count=1 ./...` | 5 package có test, tất cả pass |
| Integration test | `go test -tags=integration -count=1 -v ./tests/integration/...` trên **MariaDB 11.4.9 thật** (instance riêng, port 3399) | 16/16 test pass |
| Mutation check | bỏ `FOR UPDATE` trong `lockRound` | `TestConcurrentTransitions` fail như mong đợi → đã khôi phục |
| Frontend | `npm run typecheck && npm test && npm run build` | sạch, 4/4 test pass, build OK |
| End-to-end | API + Vite dev + `go run ./cmd/demo -base <vite>` | 2 user chơi trọn 1 round, timeline 12 event đúng thứ tự |

**Chưa kiểm chứng:**
- `go test -race` — máy không có gcc. CI (Ubuntu) được cấu hình chạy `-race` cho cả unit và integration.
- `docker compose up` — máy không có Docker. File đã được kiểm tra cú pháp YAML, chưa chạy thật. **Việc đầu tiên nên làm.**
- GitHub Actions — chưa chạy vì chưa push.
- UI chưa được nhìn bằng mắt trong trình duyệt bởi người bootstrap (đã kiểm chứng ở mức HTTP qua Vite proxy và build). Hãy mở thử và báo lỗi giao diện.

**Lưu ý môi trường:** máy bạn đang có một Vite dev server của project NAS100 cũ chạy ở `127.0.0.1:5173`. Vì vậy MARKET FORGE dùng cổng **5180**. Nếu thấy "nhầm app", kiểm tra cổng.

## 3. Những gì chưa làm (cố ý)

Rate limit login · đổi mật khẩu · chuyển quyền owner · archive room · dọn session/idempotency cũ · test UI · SSE/WebSocket · khung thời gian khác M1 · P&L/phí · deploy production. Chi tiết và ưu tiên: [ARCHITECTURE §15](../architecture/ARCHITECTURE.md#15-technical-debt).

## 4. Năm file nên đọc đầu tiên

1. [backend/internal/dojo/trials/domain.go](../../backend/internal/dojo/trials/domain.go) — state machine + validation, Go thuần, không SQL/HTTP.
2. [backend/migrations/0004_trials.sql](../../backend/migrations/0004_trials.sql) — schema bạn đọc nhanh nhất; thấy invariant nằm trong DB.
3. [backend/internal/dojo/trials/service.go](../../backend/internal/dojo/trials/service.go) — `CommitDecision`, `Transition`: transaction và lock order.
4. [backend/internal/app/app.go](../../backend/internal/app/app.go) — toàn bộ route trên một màn hình.
5. [backend/tests/integration/flow_test.go](../../backend/tests/integration/flow_test.go) — "tài liệu sống" về hệ thống phải hoạt động thế nào.

## 5. Request đầu tiên nên trace

`POST /api/v1/rounds/{id}/decisions` — nó đi qua mọi lớp: middleware → auth + CSRF → handler → validation → transaction → idempotency → row lock → membership → state check → insert (unique constraint) → audit → commit.

Cách trace:
1. Chạy API + MariaDB, chạy `go run ./cmd/demo` để có dữ liệu.
2. Trong VS Code, cài extension Go, đặt breakpoint ở `trials.(*Handler).CommitDecision` và `trials.(*Service).CommitDecision`, chạy API bằng debugger (F5, `program: backend/cmd/api`, env `MF_DATABASE_DSN`).
3. Trong UI, commit một decision → bước qua từng dòng (F10/F11).
4. Song song, bật general log tạm thời trên **DB dev**: `SET GLOBAL general_log = 1;` → xem đúng các câu SQL (`BEGIN`, `INSERT idempotency_keys`, `SELECT ... FOR UPDATE`, `INSERT decisions`, `UPDATE rooms`, `INSERT audit_events`, `COMMIT`). Tắt lại: `SET GLOBAL general_log = 0;`.

## 6. Ba bài tập Go dễ nhất trong repo

1. **`RoundStatus.IsTerminal()`** + test (Learning Path bài 2). Chỉ đụng `domain.go` và `domain_test.go`.
2. **Endpoint `GET /api/v1/version`** (bài 5). Một handler nhỏ trong `app.go`, kiểm bằng curl.
3. **Test `NormalizeDSN`** (bài 8). Unit test thuần, không cần DB.

## 7. Module không nên thay đổi khi chưa hiểu rõ

| Module | Vì sao nhạy cảm |
|---|---|
| `internal/platform/database/database.go` (`WithTx`) | Mọi transaction đi qua đây; sai là mất nguyên tử ở mọi nơi |
| `internal/idempotency` | Sai thứ tự claim/complete → bản ghi trùng khi retry |
| `internal/dojo/trials/service.go` (lock order) | Đổi thứ tự khoá → deadlock hoặc race |
| `internal/marketdata/generator.go` | Đổi một dòng → mọi fingerprint cũ không tái lập được (test golden sẽ báo) |
| `migrations/*.sql` đã áp dụng | Không bao giờ sửa; thêm file mới |
| `identity` (cookie, CSRF, hash token) | Lỗ hổng bảo mật trực tiếp |

## 8. Push lên GitHub — trạng thái và lệnh

Remote `origin` = `https://github.com/khoalysitinh/market-forge.git`. Tác giả commit: `khoaly <lyanhkhoa426@gmail.com>` (owner xác nhận). Lịch sử đã bỏ các dòng `Co-Authored-By` của AI trước lần push đầu.

Nếu repo chưa tồn tại: tạo repo rỗng trên GitHub (web: New repository → tên `market-forge`, **không** tick README/.gitignore/license), rồi:

```bash
cd "C:\Users\Administrator\Downloads\MARKET FORGE"
git remote -v                       # xác nhận đúng URL (origin đã được thêm)
git status                          # phải sạch
git push -u origin main             # KHÔNG dùng --force
```

Sau khi push: vào tab **Actions** xem CI. Nếu CI đỏ, phát hành vẫn là **PARTIAL** cho đến khi sửa.

Cho team vào: GitHub → repo → **Settings → Collaborators → Add people** (hoặc tạo Organization + team `frontend`). Bật **branch protection** cho `main`: bắt buộc PR, 1 review, CI xanh, cấm force-push. Yêu cầu mọi người đọc [READ_FIRST.md](../../READ_FIRST.md) trước.

## 9. 10 GitHub Issues đề xuất (dễ → khó)

1. **chore: chạy Docker Compose lần đầu và sửa lỗi**
   AC: `docker compose up --build` chạy đủ 4 service; `/api/v1/ready` = 200; UI ở :5180 đăng nhập được; ghi kết quả vào README.
2. **feat: `GET /api/v1/version`**
   AC: trả `engine_version`, `generator_version`; không cần auth; có test; cập nhật API.md.
3. **feat: `RoundStatus.IsTerminal()` và dùng nó trong `views.go`**
   AC: unit test cho 4 trạng thái; `GetTrial` dùng method thay vì so sánh chuỗi.
4. **test: kiểm tra response không bao giờ chứa seed**
   AC: integration test như Learning Path bài 15; fail khi xoá `json:"-"`.
5. **feat: hiển thị số người đã commit "2/3" trong UI và trong `RoundView`**
   AC: field `committed_count`, `member_count` do server tính; test integration; UI hiển thị.
6. **feat: rate limit đăng nhập**
   AC: sau 10 lần sai / 15 phút / username → `429 TOO_MANY_ATTEMPTS`; lưu trong MariaDB (không bộ nhớ); test integration; ADR ngắn.
7. **chore: job dọn session hết hạn và idempotency key > 7 ngày**
   AC: lệnh `cmd/cleanup` (hoặc goroutine có ticker + context) xoá theo lô có `LIMIT`; test; không chạm bảng append-only.
8. **feat: chuyển quyền OWNER**
   AC: `POST /rooms/{id}/transfer-owner {user_id}` chỉ owner gọi được, target phải là member; cập nhật `rooms.owner_id` + roles trong một tx; event `OWNER_TRANSFERRED`; ADR; test concurrency với lock.
9. **test: làm `TestCommitRacingLock` tất định**
   AC: thêm điểm chặn (hook chỉ có trong test) giữa đọc trạng thái và insert; chứng minh test fail khi bỏ `FOR UPDATE`.
10. **feat: báo cáo tiến bộ cá nhân (Pillar D, bản tối thiểu)**
    AC: `GET /me/stats`: số decision, % có invalidation, phân bố LONG/SHORT/WAIT, trung bình confidence, số review nhận/đưa; chỉ dữ liệu của chính mình; SQL có index phù hợp; không gọi là "hiệu suất trading".

## 10. Checklist tự học & review kiến trúc

**Tự học**
- [ ] Làm xong 15 bài trong [BACKEND_LEARNING_PATH.md](BACKEND_LEARNING_PATH.md).
- [ ] Giải thích được bằng lời 10 invariant và cơ chế bảo vệ từng cái ([ARCHITECTURE §4](../architecture/ARCHITECTURE.md#4-core-invariants)).
- [ ] Tự viết lại `idempotency.Run` trên giấy mà không nhìn code.
- [ ] Chạy được integration test trên máy của mình.
- [ ] Debug một request bằng breakpoint + general log.
- [ ] Tự làm issue 2, 3, 4 đến PR, CI xanh.

**Review kiến trúc (mỗi tháng một lần cùng nhóm)**
- [ ] Có package nào import chéo bất thường? (`go list -deps ./...`)
- [ ] Có SQL nào nối chuỗi từ input? (`grep -rn '" +' backend/internal`)
- [ ] Có transaction nào gọi ra ngoài (HTTP, file) không?
- [ ] Mọi thay đổi schema đều là migration mới?
- [ ] Mọi endpoint mới có kiểm tra membership + test người ngoài?
- [ ] Mọi quyết định kiến trúc mới có ADR?
- [ ] Technical debt table còn đúng không? Ưu tiên có thay đổi không?
