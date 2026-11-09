# ADR-005: REST + polling trước, realtime sau

- **Trạng thái:** Accepted (v0.1)
- **Ngày:** 2026-11-09

## Context

Người chơi cần thấy khi người khác commit, khi owner lock/reveal. Nhịp của Dojo là theo phút (một round vài phút), không phải mili-giây.

## Decision

- API là REST/JSON. Frontend poll `GET /trials/{id}` và `GET /rounds/{id}` mỗi 3 giây, timeline mỗi 5 giây. Nến chỉ tải lại khi `clock_index` thay đổi.
- Không WebSocket/SSE trong v0.1.

## Alternatives

1. **WebSocket:** đẩy tức thì, nhưng cần quản lý kết nối, xác thực trên socket, reconnect, fan-out giữa nhiều instance (thường cần Redis pub/sub).
2. **Server-Sent Events:** đơn giản hơn WebSocket, vẫn cần fan-out khi nhiều instance.
3. **Long polling:** phức tạp hơn polling thường mà lợi ích nhỏ ở quy mô này.

## Tradeoffs

- (+) Mọi thứ là HTTP request thường: dễ debug bằng curl, dễ test, không trạng thái kết nối trên server, restart không làm mất gì.
- (+) Với 3–6 người × 2 request / 3s, tải không đáng kể.
- (−) Trễ tối đa ~3 giây.
- (−) Request lặp khi không có gì thay đổi.

## Consequences

- Khi đo được nhu cầu (nhiều phòng, trễ quan trọng), thêm SSE dựa trên `audit_events.sequence` (client gửi `after=<seq>` — endpoint `GET /rooms/{id}/events?after=` đã hỗ trợ). Cần ADR mới.
