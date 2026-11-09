# MARKET FORGE API v1

Base path: `/api/v1`. JSON UTF-8. Thời gian ISO-8601 UTC. Giá là **số nguyên ticks**; giá thật = `ticks / 10^price_scale`.

## Quy ước chung

| Chủ đề | Quy tắc |
|---|---|
| Xác thực | Cookie `mf_session` (HttpOnly) do `POST /auth/login` đặt. Route đánh dấu 🔒 cần cookie, thiếu/sai → `401 UNAUTHENTICATED`. |
| CSRF | Mọi method không phải GET trên route 🔒 phải gửi header `X-CSRF-Token: <csrf_token>` (lấy từ login hoặc `/auth/me`). Sai/thiếu → `403 CSRF_TOKEN_INVALID`. |
| Body | Chỉ `Content-Type: application/json`, tối đa 64 KiB, đúng một object, **field lạ bị từ chối** (`400 INVALID_JSON`). Sai content type → `400 UNSUPPORTED_MEDIA_TYPE`. |
| Idempotency | Route ghi chú "idempotent" nhận header `Idempotency-Key` (1–128 ký tự ASCII nhìn thấy được). Cùng key + cùng request → trả kết quả cũ kèm `Idempotent-Replayed: true`. Cùng key + request khác → `409 IDEMPOTENCY_KEY_REUSED`. Key lưu theo user + operation. |
| Người ngoài phòng | Nhận `404` (không phải 403) để không lộ ID nào tồn tại. |
| Lỗi | `{"error": {"code": "ROUND_ALREADY_LOCKED", "message": "..."}}`. `code` là hợp đồng ổn định; `message` để người đọc. Lỗi nội bộ: `500 INTERNAL` kèm request id, không có chi tiết. |
| Request ID | Mọi response có header `X-Request-ID`; dùng để tìm log. |

Mã trạng thái: `200` OK · `201` Created · `204` No Content · `400` input sai định dạng · `401` chưa đăng nhập · `403` không có quyền · `404` không tồn tại/không thuộc phòng · `409` xung đột trạng thái/trùng · `422` đúng định dạng nhưng vi phạm luật nghiệp vụ · `500` lỗi server.

---

## Probes

### `GET /health`
Luôn `200 {"status":"ok"}` khi process sống (không kiểm tra DB).

### `GET /ready`
`200 {"status":"ready","migrations":6}` khi DB trả lời và mọi migration đã chạy; ngược lại `503 {"status":"not_ready","reason":"..."}`.

---

## Auth

### `POST /auth/register`
```json
{ "username": "khoa_01", "password": "at least 10 chars", "display_name": "Khoa" }
```
- `username`: 3–32 ký tự `[a-z0-9_]` (tự chuyển chữ thường). `password`: ≥10 ký tự, ≤72 byte. `display_name`: 1–64, mặc định = username.
- `201 {"user": User}` · `400 INVALID_USERNAME | INVALID_PASSWORD | INVALID_DISPLAY_NAME` · `409 USERNAME_TAKEN`.

### `POST /auth/login`
```json
{ "username": "khoa_01", "password": "..." }
```
- `200` + `Set-Cookie: mf_session=...; HttpOnly; SameSite=Lax; Path=/api/`
```json
{ "user": User, "csrf_token": "64 hex", "expires_at": "..." }
```
- `401 INVALID_CREDENTIALS` (giống nhau cho sai user và sai mật khẩu).

### `POST /auth/logout` 🔒
Thu hồi session, xoá cookie. `204`.

### `GET /auth/me` 🔒
`200` cùng shape với login (dùng để lấy lại `csrf_token` sau khi tải lại trang).

`User = { id, username, display_name, created_at }`

---

## Rooms

### `POST /rooms` 🔒 idempotent
`{ "name": "Morning session" }` (1–80 ký tự) → `201 RoomDetail` · `400 INVALID_ROOM_NAME`.
Người tạo là `OWNER`. Event `ROOM_CREATED`.

### `GET /rooms` 🔒
`200 {"rooms": Room[]}` — các phòng mình là thành viên, mới nhất trước.

### `POST /rooms/join` 🔒
`{ "invite_code": "EDJSBR3K2Z" }` (không phân biệt hoa thường)
- `201 RoomDetail` khi mới tham gia (event `MEMBER_JOINED`), `200 RoomDetail` khi đã là thành viên.
- `404 INVITE_CODE_NOT_FOUND`.

### `GET /rooms/{id}` 🔒 member
`200 RoomDetail` · `404 ROOM_NOT_FOUND`.

```text
Room       = { id, name, owner_id, invite_code, status: "ACTIVE"|"ARCHIVED", created_at }
RoomDetail = { room: Room, my_role: "OWNER"|"MEMBER", members: [{ user_id, username, display_name, role, joined_at }] }
```

### `GET /rooms/{id}/events?after=0&limit=500` 🔒 member
Audit timeline, cũ nhất trước, `sequence > after`.
```json
{ "events": [ { "id": 1, "room_id": 1, "sequence": 1, "type": "ROOM_CREATED", "actor_id": 3,
                "subject_type": "ROOM", "subject_id": 1, "payload": {"name": "..."}, "created_at": "..." } ] }
```
Loại event: `ROOM_CREATED, MEMBER_JOINED, TRIAL_CREATED, TRIAL_STARTED, ROUND_OPENED, DECISION_COMMITTED, ROUND_LOCKED, REVIEW_SUBMITTED, MARKET_REVEALED, ROUND_COMPLETED, TRIAL_FINISHED`.

---

## Trials

### `POST /rooms/{id}/trials` 🔒 OWNER, idempotent, không body
Sinh dataset giả lập 600 nến M1 (seed bí mật), tạo trial `CREATED` với clock = 119 (120 nến warm-up).
- `201 TrialView` · `403 OWNER_ONLY` · `404 ROOM_NOT_FOUND` · `409 ACTIVE_TRIAL_EXISTS` (đã có trial chưa FINISHED).

### `GET /rooms/{id}/trials` 🔒 member
`200 {"trials": Trial[]}`.

### `GET /trials/{id}` 🔒 member
`200 TrialView` · `404 TRIAL_NOT_FOUND`.

```text
Trial     = { id, room_id, dataset_id, dataset_fingerprint, engine_version, status: "CREATED"|"RUNNING"|"FINISHED",
              clock_index, round_bars, created_by, created_at, updated_at }
TrialView = { trial: Trial,
              dataset: { id, label, symbol, timeframe, generator_version, start_time, candle_count, price_scale, fingerprint },
              clock_time,            // open time của nến tại clock_index
              my_role, rounds: Round[], current_round_id: number|null }
```
`dataset` **không bao giờ** chứa seed.

### `POST /trials/{id}/start` 🔒 OWNER, không body
`CREATED → RUNNING`, mở round 1. Lặp lại khi đã RUNNING → `200` (no-op).
- `200 TrialView` · `403 OWNER_ONLY` · `404` · `409 TRIAL_FINISHED`.

### `GET /trials/{id}/candles` 🔒 member
Trả **mọi** nến `seq ≤ clock_index` và không gì khác. Query param bị bỏ qua.
```json
{ "trial_id": 1, "clock_index": 119, "label": "SYNTHETIC MARKET DATA — NOT REAL NAS100",
  "symbol": "SYN-IDX", "timeframe": "M1", "price_scale": 2,
  "candles": [ { "seq": 0, "open_time": "2000-01-03T14:30:00Z", "o": 1800000, "h": 1800412, "l": 1799650, "c": 1800120, "v": 312 } ] }
```

---

## Rounds

```text
Round = { id, trial_id, round_no, status: "DECISION_OPEN"|"REVIEW_BLIND"|"REVEALED"|"COMPLETED",
          decision_clock_index, reveal_clock_index|null, opened_at, locked_at|null, revealed_at|null, completed_at|null }
```

### `GET /rounds/{id}` 🔒 member → `200 RoundView`
```text
RoundView = {
  round: Round, room_id, my_role,
  participants: [{ user_id, display_name, role, committed: bool }],
  my_decision: Decision|null,          // luôn thấy quyết định của mình
  decisions_sealed: bool,              // true khi DECISION_OPEN
  decisions: Decision[],               // [] khi sealed
  reviews: Review[],                   // [] khi sealed
  outcome: Outcome|null                // chỉ khi REVEALED/COMPLETED
}
Decision = { id, round_id, user_id, author_name, direction, thesis, invalidation, confidence, risk_note,
             dataset_fingerprint, known_at_clock_index, known_at_candle_time, committed_at }
Review   = { id, round_id, decision_id, reviewer_id, reviewer_name, thesis_clear, invalidation_defined,
             risk_defined, evidence_based, feedback, created_at }
Outcome  = { from_clock_index, to_clock_index, decision_close, reveal_close, window_high, window_low,
             move_ticks, price_scale, note }   // biến động thị trường, KHÔNG phải P&L
```

### `POST /rounds/{id}/decisions` 🔒 member, idempotent
```json
{ "direction": "LONG", "thesis": "≥10 ký tự", "invalidation": "≥5 ký tự nếu LONG/SHORT",
  "confidence": 3, "risk_note": "tuỳ chọn, ≤500" }
```
- `confidence` 1–5: mức tin rằng kế hoạch đúng trong cửa sổ reveal tới (1 = đoán, 5 = rất chắc).
- Server tự điền `user_id`, `known_at_clock_index`, `known_at_candle_time`, `dataset_fingerprint`, `committed_at`.
- `201 {"decision": Decision}`
- `400 INVALID_DIRECTION | INVALID_THESIS | INVALID_INVALIDATION | INVALID_CONFIDENCE | INVALID_RISK_NOTE`
- `422 INVALIDATION_REQUIRED` · `404 ROUND_NOT_FOUND`
- `409 ROUND_ALREADY_LOCKED` (không còn DECISION_OPEN) · `409 DECISION_ALREADY_COMMITTED` (đã có; **không thể sửa**)

### `POST /rounds/{id}/lock` 🔒 OWNER
`DECISION_OPEN → REVIEW_BLIND`. Cần ≥1 decision. Event `ROUND_LOCKED`.
- `200 RoundView` · `403 OWNER_ONLY` · `404` · `409 INVALID_ROUND_TRANSITION` · `422 NO_DECISIONS_TO_LOCK`.

### `POST /rounds/{id}/reviews` 🔒 member, idempotent
```json
{ "decision_id": 12, "thesis_clear": true, "invalidation_defined": true,
  "risk_defined": false, "evidence_based": true, "feedback": "tuỳ chọn, ≤2000" }
```
- Chỉ khi `REVIEW_BLIND`. Không review quyết định của chính mình. Một review / reviewer / decision.
- `201 {"review": Review}` · `404 DECISION_NOT_FOUND | ROUND_NOT_FOUND` · `409 REVIEW_NOT_ALLOWED | REVIEW_ALREADY_SUBMITTED` · `422 CANNOT_REVIEW_OWN_DECISION`.

### `POST /rounds/{id}/reveal` 🔒 OWNER
`REVIEW_BLIND → REVEALED`; clock tiến `round_bars` (30) nến, cùng transaction. Event `MARKET_REVEALED`.
- `200 RoundView` (có `outcome`) · `403` · `404` · `409 INVALID_ROUND_TRANSITION`.

### `POST /rounds/{id}/complete` 🔒 OWNER
`REVEALED → COMPLETED`. Nếu còn đủ dữ liệu: mở round kế tiếp tại clock hiện tại (`ROUND_OPENED`); nếu không: trial `FINISHED` (`TRIAL_FINISHED`).
- `200 RoundView` · `403` · `404` · `409 INVALID_ROUND_TRANSITION`.

**Lặp lại transition:** gọi lại `lock`/`reveal`/`complete` khi round đã ở đúng trạng thái đích → `200`, không ghi gì thêm.

---

## Thử nhanh bằng curl

```bash
B=http://127.0.0.1:8080/api/v1
curl -s -c jar -H 'Content-Type: application/json' -d '{"username":"khoa","password":"correct horse battery"}' $B/auth/register
CSRF=$(curl -s -c jar -H 'Content-Type: application/json' -d '{"username":"khoa","password":"correct horse battery"}' $B/auth/login | sed 's/.*"csrf_token":"\([0-9a-f]*\)".*/\1/')
curl -s -b jar -H "X-CSRF-Token: $CSRF" -H 'Content-Type: application/json' -H 'Idempotency-Key: demo-1' -d '{"name":"Dojo"}' $B/rooms
```
