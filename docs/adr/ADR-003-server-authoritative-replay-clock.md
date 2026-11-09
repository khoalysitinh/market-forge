# ADR-003: Replay clock do server quyết định

- **Trạng thái:** Accepted (v0.1)
- **Ngày:** 2026-11-09

## Context

Pillar A — Blind Practice: người chơi không được thấy nến tương lai. Nếu browser nhận cả dataset hoặc được tự chọn mốc thời gian, chỉ cần mở DevTools là "nhìn trộm" được — toàn bộ giá trị luyện tập biến mất.

## Decision

- `trials.clock_index` là nguồn sự thật duy nhất về "bây giờ". Nến `seq <= clock_index` là thứ duy nhất được trả về.
- `GET /trials/{id}/candles` không nhận tham số cutoff; mọi query param bị bỏ qua.
- Chỉ hành động `reveal` (OWNER, từ `REVIEW_BLIND`) di chuyển clock, chỉ tiến, trong cùng transaction với chuyển trạng thái round.
- Seed của dataset bí mật (sinh bằng `crypto/rand`, không bao giờ ra JSON), vì seed + generator = toàn bộ tương lai.
- Decision lưu `known_at_clock_index` và `dataset_fingerprint` do server điền.
- v0.1 chỉ hỗ trợ M1 — không có nến khung lớn đang hình thành.

## Alternatives

1. Gửi toàn bộ dataset, client tự ẩn: không an toàn.
2. Client gửi `to=timestamp`, server kiểm tra ≤ clock: an toàn nếu làm đúng, nhưng thêm bề mặt lỗi mà không có lợi ích.
3. Clock theo thời gian thực (tự chạy): cần scheduler, khó test; không phù hợp nhịp "cùng quyết định rồi cùng mở".

## Tradeoffs

- (+) Không thể lộ tương lai qua API, kể cả khi frontend có bug.
- (−) Mỗi lần reveal client phải tải lại nến (≤600 nến, nhỏ).
- (−) Owner là người duy nhất điều khiển nhịp.

## Consequences

- Mọi endpoint mới trả dữ liệu giá phải đi qua `marketdata.ListCandlesUpTo` với clock từ DB.
- Test `TestCandlesNeverExceedServerClock` là hàng rào hồi quy.
