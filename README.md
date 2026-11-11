# MARKET FORGE — The Trading Dojo

> **Train the decision. Not just the trade.**

> 📌 **Thành viên mới (backend hay frontend): đọc [READ_FIRST.md](READ_FIRST.md) trước tiên.**

MARKET FORGE là một **nền tảng luyện ra quyết định** cho một nhóm nhỏ trader/lập trình viên. Mọi người cùng xem một thị trường *giả lập*, mỗi người ghi lại quyết định **LONG / SHORT / WAIT** kèm luận điểm *trước khi* biết diễn biến, quyết định bị **niêm phong**, cả nhóm review chéo một cách **mù** (chưa thấy tương lai), rồi mới cùng **mở** diễn biến tiếp theo.

⚠️ **Đây không phải** hệ thống dự báo giá, bot kiếm tiền hay sàn giao dịch. v0.1 chỉ dùng **dữ liệu giả lập** (`SYNTHETIC MARKET DATA — NOT REAL NAS100`), không kết nối broker, không có tiền thật, không tính P&L.

**Trạng thái:** v0.1 Foundation Release — xem [Trạng thái phát hành](#trạng-thái-phát-hành).

---

## Mục lục

- [Scope v0.1](#scope-v01)
- [Kiến trúc tổng quan](#kiến-trúc-tổng-quan)
- [Yêu cầu cài đặt](#yêu-cầu-cài-đặt)
- [Chạy bằng Docker Compose](#cách-1--docker-compose)
- [Chạy không cần Docker](#cách-2--không-dùng-docker)
- [Migrations](#migrations)
- [Chạy test](#chạy-test)
- [Demo hai tài khoản](#demo-hai-tài-khoản)
- [Giới hạn hiện tại](#giới-hạn-hiện-tại)
- [Tài liệu](#tài-liệu)

---

## Scope v0.1

**Có:**

| Tính năng | Ghi chú |
|---|---|
| Đăng ký / đăng nhập / đăng xuất | bcrypt, session phía server, cookie HttpOnly, CSRF token |
| Phòng (Room) | Tạo phòng, tham gia bằng invite code, vai trò OWNER/MEMBER |
| Trial | Mỗi trial sinh một dataset M1 giả lập (600 nến), deterministic theo seed bí mật |
| Replay clock do server sở hữu | Client **không thể** xin nến tương lai; mọi endpoint cắt theo `clock_index` |
| Round | `DECISION_OPEN → REVIEW_BLIND → REVEALED → COMPLETED`, chỉ OWNER chuyển trạng thái |
| Quyết định niêm phong | 1 quyết định / người / round, bất biến sau commit (constraint + trigger DB) |
| Blind review | Checklist 4 tiêu chí + feedback, chỉ trong `REVIEW_BLIND`, không tự review mình |
| Reveal | Mở 30 nến tiếp theo, hiển thị biến động giá (không phải P&L) |
| Audit log | Append-only, sequence liên tục theo phòng, ghi cùng transaction |
| Idempotency | Header `Idempotency-Key` lưu trong DB, an toàn khi retry đồng thời |
| Frontend tối thiểu | React + TS + Vite, chart SVG, polling 3s |
| Test | Unit + integration trên MariaDB thật (concurrency, restart, bảo mật) |
| CI | GitHub Actions: gofmt, vet, unit (race), integration (MariaDB 11.4), frontend |

**Không có (cố ý):** tiền thật, broker/MT5, live data, AI dự báo, copy trading, microservices, Redis/Kafka, order book, ledger, WebSocket. Xem [ROADMAP](docs/roadmap/ROADMAP.md).

## Kiến trúc tổng quan

```text
Browser (React)  ──HTTP/JSON + cookie──►  Vite dev proxy (/api)  ──►  Go API (một binary)
                                                                      │
                     ┌────────────────────────────────────────────────┤
                     │ internal/app        wiring + routes            │
                     │ identity            users, sessions, CSRF      │
                     │ dojo/rooms          rooms, membership          │
                     │ dojo/trials         trial, round, decision,    │
                     │                     review, replay clock       │
                     │ marketdata          synthetic OHLCV generator  │
                     │ audit, idempotency  append-only log, retries   │
                     │ platform/*          config, db, http, logging  │
                     └────────────────────────────────────────────────┤
                                                                      ▼
                                                              MariaDB (InnoDB)
```

Modular monolith: **một** process, **một** database, module tách theo nghiệp vụ. Chi tiết: [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md).

## Yêu cầu cài đặt

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| Git | bất kỳ bản mới | |
| Go | **1.26+** (đã kiểm thử với 1.27.3) | https://go.dev/dl/ |
| Node.js | **20.19+ hoặc 22.12+** (đã kiểm thử 22.14) | kèm npm. Nếu `npm install` báo lỗi `edgesOut`, đó là bug của npm 11.1 — dùng `npx npm@11.21.1 install` |
| MariaDB | **11.4** (LTS) | qua Docker, hoặc cài sẵn |
| Docker + Compose v2 | tuỳ chọn | để chạy cả stack bằng một lệnh |

## Clone

```bash
git clone https://github.com/khoalysitinh/market-forge.git
cd market-forge
cp .env.example .env      # rồi sửa mật khẩu trong .env — KHÔNG commit .env
```

## Cách 1 — Docker Compose

```bash
docker compose up --build
```

- UI: http://localhost:5180
- API: http://localhost:8080/api/v1/health và `/api/v1/ready`
- Compose chạy: `mariadb` (có healthcheck, volume) → `migrate` (một lần) → `api` → `web`.
- Script `scripts/mariadb-init/01-test-database.sh` tạo sẵn database `marketforge_test` cho integration test (chỉ chạy lần đầu tạo volume).
- Xoá sạch dữ liệu local: `docker compose down -v` (**xoá volume**, cẩn thận).

## Cách 2 — Không dùng Docker

Cần một MariaDB 11.4 đang chạy. Tạo database và user (chạy bằng tài khoản admin của MariaDB, **chỉ cho máy dev**):

```sql
CREATE DATABASE marketforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'marketforge'@'localhost' IDENTIFIED BY 'đổi-mật-khẩu-này';
GRANT ALL ON marketforge.* TO 'marketforge'@'localhost';
GRANT ALL ON `marketforge\_test`.* TO 'marketforge'@'localhost';  -- cho integration test
```

Rồi (PowerShell trên Windows dùng `.\scripts\mf.ps1 <lệnh>`, Git Bash/Linux dùng `make <lệnh>`):

```bash
# Terminal 1 — backend
export MF_DATABASE_DSN='marketforge:đổi-mật-khẩu-này@tcp(127.0.0.1:3306)/marketforge'
cd backend
go run ./cmd/migrate        # áp dụng migrations
go run ./cmd/api            # API ở :8080

# Terminal 2 — frontend
cd frontend
npm ci
npm run dev                 # http://localhost:5180 (proxy /api -> 127.0.0.1:8080)
```

PowerShell đặt biến môi trường: `$env:MF_DATABASE_DSN = 'marketforge:...@tcp(127.0.0.1:3306)/marketforge'` (hoặc ghi vào `.env`, `scripts/mf.ps1` sẽ tự đọc).

Biến cấu hình: xem [.env.example](.env.example). Bắt buộc duy nhất là `MF_DATABASE_DSN`. Khi deploy qua HTTPS phải đặt `MF_COOKIE_SECURE=true`.

## Migrations

- File SQL đánh số trong [backend/migrations/](backend/migrations/), được **nhúng vào binary** (`go:embed`).
- `go run ./cmd/migrate` áp dụng file chưa chạy, ghi vào bảng `schema_migrations` kèm SHA-256.
- **Forward-only:** không sửa file đã áp dụng (runner sẽ báo lỗi checksum). Sửa sai bằng migration mới.
- MariaDB tự commit DDL → một migration *không* nguyên tử. Giữ mỗi file nhỏ.
- `GET /api/v1/ready` trả 503 nếu còn migration chưa chạy.

## Chạy test

```bash
cd backend
go vet ./...
go test -count=1 ./...                        # unit tests, không cần DB

# integration tests — CẦN một database tên kết thúc bằng _test
export MF_TEST_DATABASE_DSN='marketforge:...@tcp(127.0.0.1:3306)/marketforge_test'
go test -tags=integration -count=1 -v ./tests/integration/...

cd ../frontend
npm run typecheck && npm test && npm run build
```

⚠️ Integration test **DROP và tạo lại** database đích. Harness từ chối chạy nếu tên database không kết thúc bằng `_test`. Không bao giờ trỏ nó vào database thật.

`go test -race` cần CGO + trình biên dịch C (gcc). Trên Windows không có gcc thì bỏ `-race`; CI (Linux) luôn chạy `-race`.

## Demo hai tài khoản

**Tự động (CLI)** — khi API đang chạy:

```bash
cd backend
go run ./cmd/demo -base http://127.0.0.1:8080
```

Chương trình tạo 2 user (alice, bob), chơi trọn một round, in từng bước và audit timeline. Đọc [backend/cmd/demo/main.go](backend/cmd/demo/main.go) để thấy chính xác frontend gọi API thế nào.

**Thủ công (UI)** — mở http://localhost:5180 ở **hai trình duyệt khác nhau** (hoặc một cửa sổ ẩn danh), vì mỗi trình duyệt giữ một session cookie:

1. Trình duyệt A: Register `alice` → Create room → copy invite code.
2. Trình duyệt B: Register `bob` → Join with invite code.
3. A: mở room → **New trial** → **Start trial**.
4. A và B: chọn hướng, viết thesis, **Commit sealed decision**. Mỗi người chỉ thấy *người kia đã commit*, không thấy nội dung.
5. A: **Lock decisions** → B thấy quyết định của A và gửi **blind review**.
6. A: **Reveal next candles** → cả hai thấy 30 nến mới và biến động giá.
7. A: **Complete round** → round 2 mở. Mở "Event timeline" để xem audit log.

## Giới hạn hiện tại

- Chỉ khung M1, dữ liệu giả lập; không có P&L, phí, spread, slippage.
- Không có rate limit cho login, không có đổi mật khẩu / xoá tài khoản.
- Không chuyển quyền OWNER; nếu owner vắng mặt, round đứng yên (trạng thái vẫn an toàn trong DB).
- Polling 3 giây thay cho realtime.
- UI tối giản, chưa có test giao diện (chỉ unit test hàm format).
- Docker Compose **chưa được chạy thử** trên máy bootstrap (máy không có Docker) — CI chạy MariaDB dạng service container.
- Danh sách đầy đủ và mức ưu tiên: [Technical debt](docs/architecture/ARCHITECTURE.md#15-technical-debt).

## Trạng thái phát hành

Xem [OWNER_HANDOFF.md](docs/learning/OWNER_HANDOFF.md) để biết chính xác cái gì đã được kiểm chứng và cái gì chưa.

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [docs/product/PRODUCT.md](docs/product/PRODUCT.md) | Tầm nhìn, pillars, người dùng |
| [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | Kiến trúc, transaction, state machine, bảo mật, technical debt |
| [docs/adr/](docs/adr/) | 5 Architecture Decision Records |
| [docs/api/API.md](docs/api/API.md) | API contract: request, response, quyền, lỗi |
| [docs/learning/BACKEND_LEARNING_PATH.md](docs/learning/BACKEND_LEARNING_PATH.md) | 15 bài học Go/backend từ chính source |
| [docs/learning/OWNER_HANDOFF.md](docs/learning/OWNER_HANDOFF.md) | Bàn giao cho owner |
| [docs/roadmap/ROADMAP.md](docs/roadmap/ROADMAP.md) | Phase 1–6 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Quy trình làm việc nhóm |
| [CLAUDE.md](CLAUDE.md) | Quy tắc cho các phiên Claude sau |
