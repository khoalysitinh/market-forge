# ADR-001: Go Modular Monolith

- **Trạng thái:** Accepted (v0.1)
- **Ngày:** 2026-11-09

## Context

Nhóm 3–6 người, vừa xây sản phẩm vừa học backend. Tải dự kiến: vài phòng, vài người mỗi phòng. Các invariant cốt lõi (không commit sau lock, không reveal trước lock, clock chỉ tiến) cần được kiểm tra **nguyên tử** trên nhiều bảng.

## Decision

Một ứng dụng Go duy nhất (`backend/cmd/api`), chia module theo nghiệp vụ trong `backend/internal/`: `identity`, `dojo/rooms`, `dojo/trials`, `marketdata`, `audit`, `idempotency`, và hạ tầng `platform/*`. Module chỉ giao tiếp qua hàm Go exported; `internal/app` là nơi duy nhất ghép tất cả lại. Ưu tiên standard library.

## Alternatives

1. **Microservices** (auth, rooms, replay riêng): cần network call, service discovery, distributed transaction/saga cho mỗi thao tác commit/lock.
2. **Framework lớn** (Gin/Echo + ORM): nhanh viết CRUD nhưng che mất HTTP lifecycle và SQL — trái mục tiêu học.
3. **Node/TypeScript full-stack**: một ngôn ngữ cho cả nhóm, nhưng mục tiêu nghề nghiệp của owner là Go backend.

## Tradeoffs

- (+) Một transaction cho mọi invariant; một binary để chạy, debug, deploy.
- (+) Đọc code thấy được toàn bộ luồng, không có "magic".
- (−) Viết tay nhiều hơn (scan SQL, decode JSON).
- (−) Mọi module scale cùng nhau; một bug panic ảnh hưởng toàn bộ (được giảm bởi middleware `Recover`).

## Consequences

- Ranh giới module phải được giữ bằng kỷ luật review (không import chéo tuỳ tiện, không vòng import — Go compiler chặn vòng).
- Nếu sau này cần tách service, ranh giới hiện có là điểm cắt; outbox/queue nằm ở Phase 5.
