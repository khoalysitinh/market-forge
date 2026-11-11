# Frontend Guide — dựng giao diện Trading Dojo

Dành cho team frontend. Đọc hết file này (~20 phút) là đủ để chạy project, hiểu sản phẩm và mở PR đầu tiên — **không cần ai giải thích thêm, không cần biết Go**.

Thứ tự đọc: [READ_FIRST.md](../../READ_FIRST.md) (luật chung, luật F1–F15) → **file này** → [API_SAMPLES.md](API_SAMPLES.md) (response thật) → [API.md](../api/API.md) (tra cứu khi cần).

---

## 1. Sản phẩm trong một câu chuyện

An và Bình cùng học trading. An tạo một **phòng**, gửi **mã mời** cho Bình.

1. An bấm tạo **trial**: server sinh một biểu đồ nến **giả lập** dài 600 phút và chỉ cho xem **120 nến đầu**. 480 nến còn lại nằm trên server, không ai xem được.
2. **Round 1 mở.** Mỗi người nhìn chart và ghi quyết định: **LONG** (đoán giá lên), **SHORT** (đoán giá xuống) hoặc **WAIT** (đứng ngoài), kèm lý do. Bấm commit là **niêm phong** — không sửa được, và người kia chỉ thấy "đã commit", không thấy nội dung.
3. An (chủ phòng) bấm **Lock**. Giờ hai người thấy quyết định của nhau và **chấm chéo** bằng một checklist — trong khi vẫn **chưa ai biết giá đi đâu**.
4. An bấm **Reveal**: server mở thêm **30 nến**. Cả hai thấy thị trường đã đi thế nào.
5. An bấm **Complete**: round 2 mở ở thời điểm mới. Lặp lại tới hết dữ liệu (16 round).

Mục đích: luyện **cách ra quyết định** (có lý do, có điểm sai, có kỷ luật), không phải đoán trúng. Vì vậy sản phẩm **không tính lãi/lỗ**.

## 2. Từ điển

| Từ | Nghĩa | Ở đâu trong API |
|---|---|---|
| **Room** | Phòng luyện tập của một nhóm | `RoomDetail` |
| **Owner / Member** | Chủ phòng (điều khiển nhịp) / thành viên | `my_role`: `"OWNER"` \| `"MEMBER"` |
| **Invite code** | Mã 10 ký tự để vào phòng | `room.invite_code` |
| **Trial** | Một phiên luyện trên một bộ dữ liệu, gồm nhiều round | `TrialView` |
| **Round** | Một vòng: quyết định → chấm → mở | `RoundView`, `round.status` |
| **Candle (nến)** | Giá trong 1 phút: mở `o`, cao nhất `h`, thấp nhất `l`, đóng `c`, khối lượng `v` | `GET /trials/{id}/candles` |
| **Clock** | "Bây giờ" của phiên: chỉ số nến cuối cùng đã mở. **Chỉ server thay đổi** | `trial.clock_index`, `clock_time` |
| **Decision** | Quyết định LONG/SHORT/WAIT đã niêm phong | `Decision` |
| **Thesis** | Luận điểm: *vì sao* quyết định như vậy | `decision.thesis` |
| **Invalidation** | Điều kiện cho thấy mình sai ("nếu giá đóng dưới X thì kế hoạch hỏng") | `decision.invalidation` |
| **Confidence** | Mức tự tin 1–5 (1 = đoán, 5 = rất chắc) | `decision.confidence` |
| **Sealed** | Đang niêm phong: chưa được xem quyết định của người khác | `decisions_sealed: true` |
| **Review** | Chấm chéo bằng checklist 4 câu + nhận xét | `Review` |
| **Outcome** | Giá đã đi bao nhiêu sau reveal. **Không phải lãi/lỗ** | `outcome` |
| **Ticks** | Giá dạng số nguyên. `1814117` với `price_scale: 2` nghĩa là `18141.17` | mọi field giá |

## 3. Ranh giới: việc của frontend, việc của server

| Server quyết định (đừng làm lại ở client) | Frontend làm |
|---|---|
| Ai là ai (session cookie) | Form đăng nhập, giữ `csrf_token` trong bộ nhớ |
| Round đang ở trạng thái nào, ai được bấm gì | Hiển thị đúng thứ server trả về; chỉ hiện nút hợp lệ |
| Nến nào được xem | Vẽ đúng các nến nhận được |
| Ai đã commit, nội dung nào được lộ | Hiển thị `participants`, `decisions` như nhận được |
| Quyết định hợp lệ hay không | Validate sớm cho thân thiện + hiển thị lỗi server |
| Giá đi bao nhiêu | Format số, hiển thị `outcome.note` |

Quy tắc ngón tay cái: **nếu bạn đang viết `if` để suy ra một sự thật nghiệp vụ, hãy tìm field tương ứng trong response.** Không có field → mở Issue cho backend, đừng tự chế.

## 4. Chạy project trên máy bạn

Bạn cần backend chạy thì UI mới có dữ liệu. Chọn **một** trong hai cách.

### Cách A — Docker (nếu máy có Docker Desktop)

```bash
git clone https://github.com/khoalysitinh/market-forge.git
cd market-forge
cp .env.example .env          # mở .env, đổi 2 dòng mật khẩu "change-me..." (và sửa cho khớp trong MF_DATABASE_DSN)
docker compose up --build
```
UI: http://localhost:5180 · API: http://localhost:8080/api/v1/ready

> ⚠️ Tính đến 2026-11-11, cách này **chưa được ai chạy thử** (máy bootstrap không có Docker). Nếu bạn là người đầu tiên: ghi lại kết quả/lỗi và mở PR sửa — đó là một đóng góp thật (issue #1).

### Cách B — Không Docker (đã kiểm chứng trên Windows 10)

Cài: **Go ≥ 1.26**, **Node ≥ 20.19 hoặc ≥ 22.12**, **MariaDB 11.4**.

1. Tạo database (chạy trong client `mariadb` bằng tài khoản root của máy bạn):
   ```sql
   CREATE DATABASE marketforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'marketforge'@'localhost' IDENTIFIED BY 'mat-khau-local';
   GRANT ALL ON marketforge.* TO 'marketforge'@'localhost';
   ```
2. Tạo file `.env` ở thư mục gốc repo (file này không bao giờ được commit):
   ```ini
   MF_DATABASE_DSN=marketforge:mat-khau-local@tcp(127.0.0.1:3306)/marketforge
   ```
3. Ba terminal (PowerShell; trên macOS/Linux/Git Bash thay `.\scripts\mf.ps1 X` bằng `make X` sau khi `export` biến trong `.env`):
   ```powershell
   .\scripts\mf.ps1 migrate      # terminal 1: tạo bảng (chạy một lần, và mỗi khi pull có migration mới)
   .\scripts\mf.ps1 run          # terminal 1: API ở http://127.0.0.1:8080

   cd frontend; npm ci; npm run dev     # terminal 2: UI ở http://localhost:5180

   .\scripts\mf.ps1 demo         # terminal 3: tạo 2 user + chơi sẵn 1 round (in ra username/mật khẩu)
   ```

Nếu PowerShell báo *"running scripts is disabled"*: chạy `powershell -ExecutionPolicy Bypass -File .\scripts\mf.ps1 migrate`.

### Thử như hai người

Mỗi trình duyệt giữ một phiên đăng nhập. Mở **Chrome** cho user 1 và **cửa sổ ẩn danh / Firefox** cho user 2. Một tab thường + một tab thường = cùng một user.

### Lỗi hay gặp khi cài

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `npm install` báo `Cannot read properties of null (reading 'edgesOut')` | Bug của npm 11.1. Dùng `npm ci`, hoặc `npx npm@11.21.1 install` |
| UI mở ra nhưng mọi request `/api` lỗi 500 trống | API chưa chạy ở `127.0.0.1:8080` (Vite proxy không tới được) |
| Mở `localhost:5180` ra **một app khác** | Máy bạn có project Vite khác đang chiếm cổng. Tắt nó, hoặc `npm run dev -- --port 5190` |
| `/api/v1/ready` trả 503 `migrations pending` | Chưa chạy `migrate` |
| API thoát ngay: `MF_DATABASE_DSN is required` | Chưa có `.env` hoặc sai tên biến |

## 5. Bản đồ code frontend hiện có

Code hiện tại đã chạy trọn luồng — dùng nó làm **bản tham chiếu đúng luật**, rồi cải tiến dần.

| File | Vai trò | Nên biết |
|---|---|---|
| [src/api/client.ts](../../frontend/src/api/client.ts) | Mọi lời gọi API đi qua `request()` | Tự gắn `X-CSRF-Token`, `Idempotency-Key`, ném `ApiError{status, code, message}` |
| [src/api/types.ts](../../frontend/src/api/types.ts) | Type của mọi response | Phải khớp [API.md](../api/API.md). Đổi API ⇒ đổi file này |
| [src/lib/usePolling.ts](../../frontend/src/lib/usePolling.ts) | Hook tải dữ liệu + lặp lại theo chu kỳ | Trả `{data, error, loading, reload}` |
| [src/lib/format.ts](../../frontend/src/lib/format.ts) | Format ticks → giá, thời gian UTC | Có unit test — mẫu cho test của bạn |
| [src/lib/router.ts](../../frontend/src/lib/router.ts) | Hash router tí hon: `#/`, `#/rooms/1`, `#/trials/1` | |
| [src/App.tsx](../../frontend/src/App.tsx) | Khởi động: gọi `/auth/me`, chọn trang | |
| [src/pages/AuthPage.tsx](../../frontend/src/pages/AuthPage.tsx) | Đăng ký / đăng nhập | |
| [src/pages/LobbyPage.tsx](../../frontend/src/pages/LobbyPage.tsx) | Danh sách phòng, tạo, join | |
| [src/pages/RoomPage.tsx](../../frontend/src/pages/RoomPage.tsx) | Thành viên, mã mời, danh sách trial | |
| [src/pages/TrialPage.tsx](../../frontend/src/pages/TrialPage.tsx) | **Workspace chính** | Chứa `RoundPanel`, `OwnerControls`, `OutcomeBox`, `Timeline` |
| [src/components/CandleChart.tsx](../../frontend/src/components/CandleChart.tsx) | Chart nến bằng SVG thuần | |
| [src/components/DecisionForm.tsx](../../frontend/src/components/DecisionForm.tsx) | Form quyết định niêm phong | |
| [src/components/ReviewForm.tsx](../../frontend/src/components/ReviewForm.tsx) | Checklist blind review | |
| [src/styles.css](../../frontend/src/styles.css) | Design tokens (`:root`) + dark theme | |

## 6. Dữ liệu chảy thế nào ở màn hình Trial

Chưa có WebSocket — UI **hỏi lại server định kỳ** (polling):

```text
mỗi 3s  GET /trials/{id}   ──► trial.status, clock_index, rounds[], current_round_id
mỗi 3s  GET /rounds/{id}   ──► round.status, participants, my_decision, decisions, reviews, outcome
mỗi 5s  GET /rooms/{id}/events ──► timeline
khi clock_index ĐỔI  ──► GET /trials/{id}/candles   (không poll nến theo giờ)

sau mỗi hành động của người dùng (commit, lock, review…) ──► gọi reload() ngay, không chờ 3s
```

Không poll nhanh hơn 1 giây. Không tự tăng `clock_index` ở client để "đoán trước".

## 7. Bảng quan trọng nhất: trạng thái → giao diện

Mọi thứ trên panel bên phải suy ra từ **ba field**: `round.status`, `my_role`, `my_decision`.

| `round.status` | Điều kiện thêm | Hiển thị | Nút owner (chỉ khi `my_role = OWNER`) |
|---|---|---|---|
| *(chưa có round — `trial.status = CREATED`)* | | Chart 120 nến warm-up + "Chờ owner bắt đầu" | **Start trial** |
| `DECISION_OPEN` | `my_decision = null` | **Form quyết định** + danh sách ai đã commit (●/○) | **Lock** |
| `DECISION_OPEN` | `my_decision ≠ null` | Thẻ "quyết định đã niêm phong" của mình (không nút sửa) + ●/○ | **Lock** |
| `REVIEW_BLIND` | | Mọi quyết định + review đã có. **Form review** dưới quyết định của *người khác* mà mình chưa chấm. Chart **không đổi** | **Reveal** |
| `REVEALED` | | **Outcome** (kèm `outcome.note`) + chart thêm 30 nến (tô nền vùng mới) + quyết định + review. Không còn form review | **Complete** |
| `COMPLETED` | | Chế độ xem lại, chỉ đọc | — |
| *(`trial.status = FINISHED`)* | `current_round_id = null` | "Trial đã kết thúc" + xem lại các round | — (tạo trial mới ở trang Room) |

Ghi chú:
- Owner bấm **Lock** khi chưa ai commit → server trả `422 NO_DECISIONS_TO_LOCK`. Hiển thị lỗi đó, không cần tự chặn.
- Member **không bao giờ** thấy nút owner. Nếu vẫn gọi được → `403 OWNER_ONLY`.
- Người vào phòng sau khi lock: không có form quyết định (server trả `409 ROUND_ALREADY_LOCKED` nếu cố gửi).
- Xem response thật của từng dòng trong [API_SAMPLES.md](API_SAMPLES.md).

## 8. Từng màn hình

### A. Authentication

| Hành động | API | Lỗi cần hiển thị |
|---|---|---|
| Đăng ký | `POST /auth/register` rồi tự `POST /auth/login` | `INVALID_USERNAME`, `INVALID_PASSWORD`, `USERNAME_TAKEN` |
| Đăng nhập | `POST /auth/login` → lưu `csrf_token` vào bộ nhớ | `INVALID_CREDENTIALS` |
| Tải lại trang | `GET /auth/me` → 200: vào app, lấy lại `csrf_token`; 401: màn hình login | |
| Đăng xuất | `POST /auth/logout` (204) → xoá `csrf_token`, về login | |

Username: 3–32 ký tự `a-z 0-9 _`. Mật khẩu: ≥ 10 ký tự.

### B. Lobby và Room

| Hành động | API | Ghi chú |
|---|---|---|
| Danh sách phòng | `GET /rooms` | Empty state khi chưa có phòng |
| Tạo phòng | `POST /rooms` + `Idempotency-Key` | Tên 1–80 ký tự |
| Vào phòng | `POST /rooms/join` `{invite_code}` | 201 = mới vào, 200 = đã là thành viên. Lỗi `INVITE_CODE_NOT_FOUND` |
| Trang phòng | `GET /rooms/{id}` + `GET /rooms/{id}/trials` | Hiện mã mời, thành viên, danh sách trial |
| Tạo trial (owner) | `POST /rooms/{id}/trials` + `Idempotency-Key` | Lỗi `ACTIVE_TRIAL_EXISTS` nếu còn trial chưa xong |

### C. Trial Workspace

```text
┌──────────────────────────────────────────────┬────────────────────────────────┐
│ SYN-IDX  M1   [RUNNING]    [SYNTHETIC … NAS100]│ ← room   R1  R2  R3            │
│ Server clock: 16:29 UTC (nến #119 / 600)       │ Round 2          [DECISION_OPEN]│
│ ┌──────────────────────────────────────────┐  │ Participants                    │
│ │                                          │  │  ● An (owner)   ○ Bình          │
│ │            biểu đồ nến                   │  │ ┌ Owner control ─────────────┐ │
│ │      (chỉ các nến server đã mở)          │  │ │ [ Lock decisions ]         │ │
│ │                                          │  │ └────────────────────────────┘ │
│ └──────────────────────────────────────────┘  │ Your decision                   │
│ dataset 4a54f5f8…  · dojo-engine-v1            │  [LONG] [SHORT] [WAIT]          │
│ ▸ Event timeline                               │  Thesis … Invalidation …        │
│                                                │  Confidence ──●──  Risk note    │
│                                                │  [ Commit sealed decision ]     │
└──────────────────────────────────────────────┴────────────────────────────────┘
        màn hình hẹp (< 900px): hai cột xếp chồng, chart ở trên
```

Form quyết định (server kiểm tra lại tất cả):

| Field | Luật | Lỗi server |
|---|---|---|
| `direction` | `LONG` \| `SHORT` \| `WAIT` | `INVALID_DIRECTION` |
| `thesis` | 10–2000 ký tự | `INVALID_THESIS` |
| `invalidation` | ≤ 1000; **bắt buộc ≥ 5 ký tự nếu LONG/SHORT** | `INVALID_INVALIDATION`, `INVALIDATION_REQUIRED` (422) |
| `confidence` | số nguyên 1–5 | `INVALID_CONFIDENCE` |
| `risk_note` | tuỳ chọn, ≤ 500 | `INVALID_RISK_NOTE` |

**Không gửi** `user_id`, `clock_index`, thời gian… — server tự điền, và body có field lạ sẽ bị từ chối (`400 INVALID_JSON`).

### D. Review và Result

| Hành động | API | Ghi chú |
|---|---|---|
| Chấm một quyết định | `POST /rounds/{id}/reviews` + `Idempotency-Key` | Body: `decision_id` + 4 boolean + `feedback` (≤ 2000). Lỗi: `REVIEW_NOT_ALLOWED`, `REVIEW_ALREADY_SUBMITTED`, `CANNOT_REVIEW_OWN_DECISION` |
| Xem kết quả | `outcome` trong `RoundView` | Chỉ có khi `REVEALED`/`COMPLETED` |
| Timeline | `GET /rooms/{id}/events?after=<seq>` | Mới nhất hiển thị trên cùng |

4 câu checklist: luận điểm rõ ràng (`thesis_clear`) · có điểm sai (`invalidation_defined`) · có nêu rủi ro (`risk_defined`) · chỉ dựa trên thông tin lúc quyết định (`evidence_based`).

## 9. Giá và thời gian

- Giá là **số nguyên ticks**. Dùng `formatTicks(ticks, price_scale)` trong `lib/format.ts`:
  `formatTicks(1814117, 2)` → `"18141.17"` · `formatSignedTicks(2646, 2)` → `"+26.46"`.
- **Đừng** `ticks / 100` rồi `toFixed` — số thực có thể làm lệch chữ số cuối. Chia chỉ dùng để tính toạ độ vẽ chart.
- Thời gian nến (`open_time`, `clock_time`) là **UTC của dataset giả lập** (năm 2000) — hiển thị `HH:MM UTC`. Thời gian sự kiện (`committed_at`, `created_at`) là giờ thật — hiển thị theo giờ máy người dùng.

## 10. Checklist khi viết một mutation (POST)

```ts
// 1) Một key cho MỘT hành động của người dùng — tạo khi form xuất hiện
const [key] = useState(newIdempotencyKey);

// 2) Gọi qua api.* (client tự gắn X-CSRF-Token + Idempotency-Key)
await api.commitDecision(roundId, input, key);

// 3) Thành công → reload() dữ liệu từ server (đừng tự sửa state cho "giống")
// 4) Thất bại → hiển thị ApiError.code + message; GIỮ NGUYÊN key để người dùng bấm thử lại
```

- Thử lại với **cùng key + cùng nội dung** → server trả đúng kết quả cũ, không tạo bản ghi thứ hai.
- Cùng key nhưng **đổi nội dung** → `409 IDEMPOTENCY_KEY_REUSED`. Vì vậy: người dùng sửa form sau một lần lỗi *validation* thì không sao (lỗi không được lưu), nhưng sau khi **thành công** phải tạo key mới cho hành động kế tiếp.
- Hành động không thể hoàn tác (commit quyết định) → hỏi xác nhận trước.

## 11. Gỡ lỗi nhanh

| Thấy | Nghĩa là |
|---|---|
| `401 UNAUTHENTICATED` | Chưa đăng nhập / phiên hết hạn → về màn hình login |
| `403 CSRF_TOKEN_INVALID` | Thiếu header `X-CSRF-Token` — thường do reload trang mà chưa gọi `/auth/me` |
| `403 OWNER_ONLY` | Đang hiện nút owner cho member |
| `404 ..._NOT_FOUND` | Không tồn tại **hoặc** bạn không thuộc phòng đó |
| `400 INVALID_JSON` | Body sai kiểu hoặc có **field thừa** |
| `400 UNSUPPORTED_MEDIA_TYPE` | Thiếu `Content-Type: application/json` |
| `409 INVALID_ROUND_TRANSITION` | UI đang hiện nút không hợp với `round.status` (dữ liệu cũ → reload) |
| `500 INTERNAL (request id …)` | Lỗi server: gửi request id + các bước tái hiện cho backend |

Mọi response có header `X-Request-ID`. Kèm nó khi báo lỗi cho backend.

## 12. PR đầu tiên của bạn

1. `git switch -c feat/web-<tên-ngắn>` từ `main` mới nhất.
2. Làm một việc nhỏ. Chạy: `cd frontend && npm run typecheck && npm test && npm run build`.
3. Thử bằng **hai trình duyệt**, chụp màn hình desktop + mobile (360px).
4. Mở PR: dán checklist "đã đọc" ([READ_FIRST.md](../../READ_FIRST.md#checklist-đã-đọc)) + Definition of Done (§10.8) + ảnh + lệnh đã chạy.
5. CI xanh + 1 review → merge. Không push thẳng `main`.

**Ba việc khởi động gợi ý (mỗi người một việc):**
- **Chạy được project theo mục 4** và mở PR sửa bất cứ bước nào trong tài liệu này bị sai/thiếu. (Ai có Docker: thử Cách A và báo kết quả.)
- **Bảng lỗi tiếng Việt:** map `error.code` → câu thân thiện, có unit test, dùng trong `ErrorBox`.
- **Lobby/Room hoàn chỉnh:** nút copy mã mời, empty state, phân biệt owner/member, responsive.

Danh sách đầy đủ 10 việc: [READ_FIRST.md §10.9](../../READ_FIRST.md#109-backlog-gợi-ý-cho-team-fe-dễ--khó).

## 13. Quy tắc React của project

Reviewer sẽ kiểm theo danh sách này. R1–R7 là quy tắc của chính React ([Rules of React](https://react.dev/reference/rules)); R8–R10 là quy ước của project.

| # | Quy tắc | Sai | Đúng |
|---|---|---|---|
| R1 | **Giao diện = hàm của dữ liệu.** Không tự sửa DOM (không jQuery, không `document.querySelector(...).innerHTML = ...`) | `$('.note').show()` | `{open && <Note />}` rồi `setOpen(true)` |
| R2 | **Sự kiện gắn thẳng vào phần tử** | `$(document).on('click', '.more', fn)` | `<button onClick={fn}>` |
| R3 | **Không sửa trực tiếp state/props** — luôn tạo giá trị mới | `list.push(x); setList(list)` | `setList([...list, x])` |
| R4 | **Hook chỉ gọi ở đầu component**, không trong `if`/vòng lặp/sau `return`; tên bắt đầu bằng `use` | `if (ok) { useState(...) }` | gọi hook trước, `if` sau |
| R5 | **Render phải "sạch"**: không gọi API, không `setState`, không ghi biến ngoài trong lúc render. Việc phụ (fetch, timer) đặt trong `useEffect`/hook và **có dọn dẹp** | `fetch(...)` giữa thân component | `usePolling(...)` (đã `clearInterval` khi rời trang) |
| R6 | **Danh sách phải có `key` ổn định** (id từ server), không dùng index | `key={i}` | `key={d.id}` |
| R7 | **Không lưu vào state thứ tính ra được** từ props/state khác | `const [count, setCount] = useState(list.length)` | `const count = list.length` |
| R8 | **Dữ liệu đi xuống qua props, sự kiện đi lên qua callback.** Dữ liệu server lấy qua `api/client.ts` — component không tự `fetch` | `fetch('/api/v1/...')` trong component | `api.getRound(id)` qua `usePolling` |
| R9 | **Không `dangerouslySetInnerHTML`** với nội dung người dùng (thesis, feedback, tên phòng). JSX tự escape — giữ nguyên như vậy | `<p dangerouslySetInnerHTML=...>` | `<p>{d.thesis}</p>` |
| R10 | **TypeScript strict:** không `any`, không `// @ts-ignore`; type response nằm trong `api/types.ts` | `const r: any = ...` | `const r: RoundView = ...` |

Một component = một file `.tsx`, tên viết hoa (`DecisionForm`), làm một việc. Hàm thuần (format, tính toán) để trong `lib/` và có unit test.

> Chưa có ESLint trong project. Thêm `eslint` + `eslint-plugin-react-hooks` (tự bắt R4, R5) là một việc tốt cho team — cần Issue/ADR ngắn vì là dev-dependency mới.

## 14. Khi cần thứ API chưa có

Mở Issue gắn nhãn `api-request`: **màn hình nào cần, cần field/endpoint gì, vì sao không suy ra được từ dữ liệu hiện có**. Trong lúc chờ, đừng tự tính ở client những thứ thuộc về server (số người đã commit thì đếm từ `participants` được; "ai thắng" thì không — và sản phẩm cố ý không có khái niệm đó).
