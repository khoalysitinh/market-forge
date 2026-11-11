# ĐỌC FILE NÀY TRƯỚC — MARKET FORGE Team Brief

> **Bắt buộc với mọi thành viên** (backend, frontend, review, QA) **trước khi** viết dòng code đầu tiên, mở PR, hay giao việc cho AI.
> Đọc xong, đánh dấu checklist ở [cuối file](#checklist-đã-đọc) trong PR đầu tiên của bạn.

**Product:** MARKET FORGE · **Core:** The Trading Dojo · **Tagline:** *Train the decision. Not just the trade.*
**Phiên bản hiện tại:** v0.1 Foundation · **Repo:** https://github.com/khoalysitinh/market-forge · **Owner:** Khoa (`khoalysitinh`)

---

## 1. MARKET FORGE là gì — và không là gì

Một **nền tảng luyện ra quyết định** có tính tương tác, nhiều người dùng. Trader cùng vào phòng luyện tập, quan sát thị trường (lịch sử hoặc giả lập) **mà không biết tương lai**, đưa ra quyết định **LONG / SHORT / WAIT**, ghi kế hoạch **trước** khi xem kết quả, quyết định bị **khoá**, cả nhóm cùng mở diễn biến, phản biện nhau, và theo dõi tiến bộ.

**KHÔNG phải:** hệ thống dự báo giá · bot kiếm tiền · sàn giao dịch tiền thật · copy trading.
Thị trường chỉ là **môi trường thực hành**. Thứ ta luyện là **quyết định**.

## 2. Thứ tự ưu tiên khi phải đánh đổi

1. Correctness
2. Data integrity
3. Reproducibility
4. Security
5. Maintainability
6. Learning value
7. User experience
8. Performance — chỉ dựa trên đo lường

**Không đánh đổi correctness để lấy giao diện đẹp hoặc số lượng tính năng.**
Nếu phải chọn giữa *hệ thống khổng lồ không ai hiểu* và *hệ thống nhỏ, đúng, có test, có tài liệu* — **chọn cái thứ hai**.

## 3. Người dùng và bốn pillar

Nhóm đầu tiên: 3–6 trader/lập trình viên học trading cùng nhau, luyện tập trên **cùng một** phiên thị trường.

| Pillar | Ý nghĩa | Hệ quả cho code |
|---|---|---|
| **A — Blind Practice** | Không ai nhận nến vượt mốc server cho phép | Server giữ replay clock. Client không bao giờ chọn mốc thời gian |
| **B — Sealed Decision** | Quyết định lưu trước khi mở kết quả, không sửa đè | Decision bất biến; nội dung ẩn với người khác tới khi lock |
| **C — Evidence-Based Review** | Đánh giá kế hoạch dựa trên thông tin có tại thời điểm quyết định | Review chỉ trong giai đoạn mù (`REVIEW_BLIND`) |
| **D — Learning Progress** | Lưu lịch sử để làm báo cáo tiến bộ | Mọi decision/review/event được lưu đầy đủ |

Vòng luyện tập: **xem chart → commit quyết định niêm phong → owner lock → blind review → owner reveal → owner complete → round mới**.

## 4. Scope

**v0.1 đã có:** auth (session + CSRF), rooms + invite code, trial với dữ liệu giả lập, replay clock do server giữ, round state machine, sealed decision, blind review, reveal, audit log, idempotency, frontend tối thiểu, unit + integration test, CI, Docker Compose, tài liệu.

**KHÔNG làm (trừ khi owner duyệt + có ADR):**
real money · broker / MT5 order execution · prop firm · nạp/rút · live market data · AI dự báo · LLM trading agent · copy trading · microservices · Kubernetes · Kafka · Redis · RabbitMQ · distributed locking · matching engine · order book · double-entry ledger · strategy optimization · counterfactual nâng cao · monetization.

**Không tự mở rộng scope chỉ vì một tính năng có vẻ thú vị.** Ý tưởng mới → mở Issue, gắn nhãn `proposal`, chờ owner.

## 5. An toàn sản phẩm (không thương lượng)

- Mọi giá v0.1 là **giả lập** và phải hiển thị nhãn **`SYNTHETIC MARKET DATA — NOT REAL NAS100`** ở mọi nơi dữ liệu giá xuất hiện.
- Không dùng logo / tên nhà cung cấp dữ liệu thật gây hiểu lầm.
- Không giả định chi phí giao dịch bằng 0; không trình bày kết quả giả lập như hiệu suất trading thật. v0.1 **không tính P&L** — chỉ hiển thị biến động thị trường.
- Không kết nối bất kỳ dịch vụ giao dịch thật nào.
- Frontend không bao giờ trực tiếp làm thay đổi phá vỡ tính toàn vẹn dữ liệu — mọi luật nằm ở server.

## 6. Kiến trúc trong một phút

```text
Browser (React + TS + Vite) ──JSON + cookie──► Go API (một binary, modular monolith) ──► MariaDB
```

- **Backend:** Go, `net/http`, `database/sql`, `log/slog`. Handler → Service → Repository → Domain.
- **Database:** MariaDB 11.4 là nguồn sự thật duy nhất. Migration SQL đánh số, forward-only.
- **Realtime:** chưa có. Frontend **polling** (ADR-005).
- Chi tiết: [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) · [ADR](docs/adr/) · [API.md](docs/api/API.md).

## 7. Mười invariant — ai làm hỏng là chặn merge

1. Một user chỉ commit **một** decision mỗi round.
2. Không commit sau khi round đã lock.
3. Không reveal trước khi đủ điều kiện (phải qua lock).
4. Replay clock không bao giờ lùi.
5. Không thể lấy nến vượt cutoff của server; **seed dataset là bí mật**.
6. Người ngoài phòng không truy cập được dữ liệu phòng (nhận 404).
7. Retry không tạo bản ghi trùng (Idempotency-Key lưu trong DB).
8. Chuyển trạng thái đồng thời không tạo trạng thái sai.
9. Không sửa/xoá decision đã commit (kể cả trực tiếp trong DB — có trigger).
10. Restart không mất trạng thái đã commit.

Mỗi invariant có test bảo vệ — xem [ARCHITECTURE §4](docs/architecture/ARCHITECTURE.md#4-core-invariants).

## 8. Quy trình làm việc chung

- **Nhánh:** `main` luôn ổn định. Làm trên `feat/...`, `fix/...`, `docs/...`, `test/...`.
- **Commit:** Conventional Commits — `feat(web): ...`, `fix(trials): ...`.
- **PR:** CI xanh + ít nhất 1 review. Không tự merge PR của mình khi chưa có review. **Không force-push**, không push thẳng `main`.
- **Không commit:** `.env`, secrets, dump DB, volume DB, `node_modules`, `dist/`, binary, dữ liệu khách hàng hay source công ty.
- **Thay đổi kiến trúc** (thêm thư viện lớn, đổi cách giao tiếp, đổi schema lớn) → viết **ADR** trong `docs/adr/` trước.
- **Không tuyên bố "test pass"** nếu chưa chạy. Ghi lệnh đã chạy và kết quả vào mô tả PR.
- Chi tiết: [CONTRIBUTING.md](CONTRIBUTING.md).

## 9. Làm việc với AI (Claude, Copilot…)

- Repo có [CLAUDE.md](CLAUDE.md): mặc định là **mentor mode** — giải thích trước, để người học tự làm, rồi review.
- AI không được tự push/merge/deploy, không chạy migration phá huỷ, không mở rộng scope, không đổi kiến trúc khi không có ADR.
- Code do AI viết **vẫn là trách nhiệm của bạn**: bạn phải đọc, hiểu, và có test.

---

## 10. Dành cho TEAM FRONTEND — triển khai FE bằng React

### 10.1 Nhiệm vụ

Biến frontend tối thiểu hiện có ([frontend/](frontend/)) thành một giao diện **Trading Dojo** dùng được hằng ngày cho nhóm 3–6 người: rõ ràng, đúng luật, responsive, dark theme kiểu trading terminal — **trên đúng API hiện có**.

Không bắt đầu lại từ số 0 nếu không cần: code hiện tại đã có API client, CSRF, idempotency key, polling, chart SVG, đủ luồng end-to-end. Hãy đọc nó trước, rồi cải tiến từng phần qua PR nhỏ.

### 10.2 Stack (đã chốt)

- **React 19 + TypeScript (strict) + Vite**, Node ≥ 20.19 / 22.12.
- Phiên bản đã khoá trong [frontend/package.json](frontend/package.json) + `package-lock.json`. Dùng `npm ci`.
- **Thêm dependency** (router, state library, chart library, UI kit…) → mở Issue/ADR ngắn nêu lý do, kích thước, license, thay thế. Không thêm thư viện vì "quen tay". Thư viện chart thương mại / có yêu cầu attribution phải ghi rõ trong ADR.
- Cổng dev: **5180** (`npm run dev`). Vite proxy `/api` → `http://127.0.0.1:8080` (đổi bằng biến `MF_API_PROXY`).

### 10.3 Luật bắt buộc cho frontend

| # | Luật | Vì sao |
|---|---|---|
| F1 | **Server là nguồn sự thật.** UI không tự suy ra trạng thái round, quyền owner, ai đã commit, giá. Chỉ hiển thị thứ API trả về | Pillar A, B; invariant 2–4 |
| F2 | **Không bao giờ** gửi mốc thời gian / cutoff / seq để xin nến. Chỉ gọi `GET /trials/{id}/candles`; tải lại khi `clock_index` đổi | Pillar A, invariant 5 |
| F3 | Không lưu, cache hay "đoán trước" dữ liệu tương lai. Không preload dataset | Pillar A |
| F4 | Khi `decisions_sealed = true`: chỉ hiển thị "đã commit / chưa", **không** cố hiển thị nội dung người khác | Pillar B |
| F5 | Decision đã commit **không có nút sửa/xoá**. Hỏi xác nhận trước khi commit | Pillar B, invariant 9 |
| F6 | Review form chỉ hiện khi `round.status = REVIEW_BLIND`, không cho review chính mình | Pillar C |
| F7 | Mọi mutation tạo bản ghi gửi **`Idempotency-Key`** — **một key cho một hành động người dùng**, giữ nguyên khi retry, tạo key mới sau khi thành công | Invariant 7 |
| F8 | Mọi request không phải GET gửi **`X-CSRF-Token`** (lấy từ login hoặc `GET /auth/me`). Dùng `credentials: "same-origin"`. **Không** đọc/ghi cookie session bằng JS (nó là HttpOnly) | Security |
| F9 | Không lưu token, mật khẩu, CSRF token vào `localStorage`/`sessionStorage` | Security |
| F10 | Nhãn `SYNTHETIC MARKET DATA — NOT REAL NAS100` luôn nhìn thấy trên chart. Không hiển thị P&L, "lợi nhuận", "win rate" như hiệu suất thật | Product safety |
| F11 | Giá là **số nguyên ticks** + `price_scale`. Format bằng hàm integer (`lib/format.ts`), không `parseFloat` rồi làm tròn | Data integrity |
| F12 | Mọi màn hình có trạng thái **Loading / Empty / Error / Success**. Hiển thị `error.code` của API | UX, debug |
| F13 | **Không có nút giả không hoạt động.** Chỉ hiện nút owner khi `my_role = OWNER` và trạng thái cho phép; server vẫn kiểm tra lại | UX, F1 |
| F14 | Không hiển thị mock value như dữ liệu thật. Dữ liệu mẫu cho Storybook/test phải ghi rõ "mock" | Product safety |
| F15 | Responsive tới 360px, không cuộn ngang. Không animation phức tạp | UI principles |

### 10.4 Các màn hình cần có

**A. Authentication** — Register, Login, Logout; thông báo lỗi theo `error.code` (`USERNAME_TAKEN`, `INVALID_CREDENTIALS`, `INVALID_PASSWORD`…).

**B. Dojo Lobby** — danh sách phòng, tạo phòng, join bằng invite code (10 ký tự, không phân biệt hoa thường).

**C. Trial Workspace** (màn hình chính)
- Chart nến synthetic + nhãn synthetic + server clock (`clock_time`, `clock_index / candle_count`).
- Trạng thái round (pill), danh sách thành viên + trạng thái commit (không lộ nội dung).
- Decision panel: LONG/SHORT/WAIT, thesis (10–2000), invalidation (bắt buộc với LONG/SHORT), confidence 1–5 (giải thích nghĩa từng mức), risk note.
- Nút điều khiển owner: Start trial → Lock → Reveal → Complete (chỉ nút hợp lệ hiện tại).

**D. Review / Result**
- Xem lại các quyết định sau lock; checklist blind review (4 tiêu chí + feedback).
- Outcome sau reveal: close lúc quyết định → close sau reveal, high/low cửa sổ, **kèm ghi chú "không phải P&L"** do API trả về.
- Event timeline (audit log) cơ bản; lịch sử các round (R1, R2, …).

### 10.5 API — đọc trước khi code

Hợp đồng đầy đủ: **[docs/api/API.md](docs/api/API.md)**. Type TypeScript tương ứng: [frontend/src/api/types.ts](frontend/src/api/types.ts).

- Base `/api/v1`, JSON, thời gian ISO-8601 UTC.
- Lỗi luôn có dạng `{"error": {"code": "...", "message": "..."}}` — dựa vào **`code`**, không dựa vào `message`.
- Polling hiện tại: trial/round 3s, timeline 5s. Không poll nhanh hơn 1s.
- Cần endpoint hay field mới? **Mở Issue cho backend** kèm lý do; không tự "chế" field ở client. Đổi API contract cần backend review + cập nhật API.md.

### 10.6 Chạy local

```bash
# Backend (cần MariaDB) — xem README
cp .env.example .env            # sửa mật khẩu
docker compose up --build       # mariadb + migrate + api + web (UI ở :5180)

# Hoặc chỉ frontend, khi đã có API chạy ở :8080
cd frontend
npm ci
npm run dev                     # http://localhost:5180

# Tạo nhanh dữ liệu mẫu: 2 user chơi 1 round
cd backend && go run ./cmd/demo -base http://127.0.0.1:8080
```

Để thử nhiều người: mở **hai trình duyệt khác nhau** (hoặc một cửa sổ ẩn danh) — mỗi trình duyệt một session.

### 10.7 Cấu trúc thư mục đề xuất

```text
frontend/src/
  api/          client.ts (fetch, CSRF, idempotency), types.ts  ← khớp API.md
  lib/          hàm thuần + test (format, router, polling)
  components/   thành phần dùng lại (Chart, StatusPill, DecisionForm, ReviewForm…)
  pages/        một file mỗi màn hình (Auth, Lobby, Room, Trial)
  styles.css    design tokens (:root) + dark theme
```

### 10.8 Definition of Done cho mỗi PR frontend

- [ ] `npm run typecheck && npm test && npm run build` pass (ghi vào PR).
- [ ] Không vi phạm luật F1–F15.
- [ ] Có Loading / Empty / Error cho dữ liệu mới.
- [ ] Hàm logic thuần có unit test (Vitest).
- [ ] Đã thử luồng với **2 user** ở 2 trình duyệt; ảnh chụp màn hình desktop + mobile (360px) trong PR.
- [ ] Không thêm dependency khi chưa có Issue/ADR được duyệt.
- [ ] Không có `console.log` thừa, không secret, không mock data hiển thị như thật.

### 10.9 Backlog gợi ý cho team FE (dễ → khó)

1. **Thông báo lỗi thân thiện theo `error.code`** — bảng map code → câu tiếng Việt; fallback hiển thị code. *AC:* mọi lỗi trong API.md có câu; test unit cho bảng map.
2. **Màn hình Lobby/Room hoàn chỉnh** — copy invite code 1 click, empty state, phân biệt owner/member. *AC:* chạy đúng với 2 user; responsive.
3. **Router có URL rõ ràng** (giữ hash router hiện tại hoặc ADR để thêm thư viện). *AC:* reload trang không mất màn hình; back/forward đúng.
4. **Decision panel chuẩn** — validate client giống server (độ dài, invalidation bắt buộc), đếm ký tự, giải thích confidence. *AC:* server vẫn là người quyết định; lỗi server hiển thị đúng field.
5. **Chart cải tiến** — crosshair, tooltip OHLC (format bằng ticks), đánh dấu nến lúc quyết định, vùng nến vừa reveal. *AC:* không đọc dữ liệu nào ngoài response của `/candles`; nhãn synthetic luôn hiện.
6. **Participants & trạng thái round** — "2/3 đã commit", ai là owner, thời điểm lock/reveal. *AC:* không lộ nội dung khi sealed (có test component).
7. **Review/Result view** — gom decision + review theo người; outcome kèm ghi chú no-P&L. *AC:* review form chỉ ở `REVIEW_BLIND`; không có form review cho decision của mình.
8. **Lịch sử round & timeline** — xem lại R1…Rn của trial; timeline lọc theo round. *AC:* dùng `GET /rooms/{id}/events?after=` để chỉ tải event mới.
9. **Component tests** (Vitest + Testing Library, cần ADR thêm dev-dependency) cho DecisionForm, ReviewForm, OwnerControls. *AC:* test bao phủ luật F4, F5, F6, F13.
10. **E2E 2 user** (Playwright, cần ADR) chạy trên CI với backend thật. *AC:* luồng register → room → trial → commit ×2 → lock → review → reveal → complete xanh trên CI.

---

## Tài liệu theo thứ tự nên đọc

1. **File này.**
2. [README.md](README.md) — cài đặt, chạy, test.
3. [docs/product/PRODUCT.md](docs/product/PRODUCT.md) — sản phẩm.
4. [docs/api/API.md](docs/api/API.md) — **bắt buộc với frontend**.
5. [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) — **bắt buộc với backend**.
6. [docs/adr/](docs/adr/) — các quyết định kiến trúc.
7. [CONTRIBUTING.md](CONTRIBUTING.md) — quy trình PR.
8. [docs/roadmap/ROADMAP.md](docs/roadmap/ROADMAP.md) — đi đâu tiếp.
9. Backend learners: [docs/learning/BACKEND_LEARNING_PATH.md](docs/learning/BACKEND_LEARNING_PATH.md).

## Checklist đã đọc

Copy vào mô tả PR đầu tiên của bạn:

```markdown
- [ ] Tôi đã đọc READ_FIRST.md và hiểu MARKET FORGE KHÔNG phải công cụ dự báo/kiếm tiền.
- [ ] Tôi thuộc 4 pillar và 10 invariant.
- [ ] Tôi biết những gì nằm NGOÀI scope và sẽ mở Issue thay vì tự làm.
- [ ] Tôi sẽ không commit secrets/.env/node_modules/dist và không force-push.
- [ ] (Frontend) Tôi đã đọc docs/api/API.md và luật F1–F15.
- [ ] (Backend) Tôi đã đọc ARCHITECTURE.md và các ADR.
```
