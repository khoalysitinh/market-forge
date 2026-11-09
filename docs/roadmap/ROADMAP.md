# MARKET FORGE — Roadmap

Nguyên tắc: mỗi phase chỉ bắt đầu khi phase trước **đúng, có test, có tài liệu**. Mọi thay đổi kiến trúc cần ADR. Không thêm hạ tầng (Redis, queue…) khi chưa **đo được** nhu cầu.

## Phase 1 — Foundation ✅ (v0.1, bản này)

Go API, MariaDB + migrations, auth + session, rooms, trial với dataset giả lập, replay clock do server giữ, round state machine, sealed decision, blind review, reveal, audit log, idempotency, frontend tối thiểu, CI, tài liệu học.

Việc còn mở trước khi gọi Phase 1 "xong hẳn": xem [OWNER_HANDOFF.md](../learning/OWNER_HANDOFF.md) (chạy thử Docker Compose, rate limit login, chuyển quyền owner…).

## Phase 2 — Trading Dojo

- UX nhiều người chơi tốt hơn: thông báo khi đến lượt, SSE thay polling (ADR mới).
- Peer review phong phú: rubric cấu hình được, thảo luận theo decision.
- Training progress: thống kê theo người (tỉ lệ có invalidation, calibration của confidence, kỷ luật WAIT).
- Cấu hình trial: độ dài warm-up, số nến mỗi round, nhiều khung thời gian (cần xử lý nến khung lớn đang hình thành).
- Chuyển quyền owner, archive room, rate limit, đổi mật khẩu.

## Phase 3 — Market Science Lab

Experiment builder, strategy variants, counterfactual forks ("nếu WAIT thì sao"), đánh giá thống kê (đủ mẫu, khoảng tin cậy). Dataset lịch sử thật **chỉ khi** có giấy phép dữ liệu và nhãn rõ ràng.

## Phase 4 — Exchange Engineering Lab

Order book giả lập, matching engine, double-entry ledger (số nguyên, không float), kiểm thử concurrency chuyên sâu. Tất cả vẫn là mô phỏng, không tiền thật.

## Phase 5 — Reliability Engineering

Redis *nếu* có nhu cầu đo được, queue, idempotent consumers, transactional outbox (từ `audit_events`), fault injection, observability (metrics, tracing), hash-chain cho audit log.

## Phase 6 — Production Engineering

CI/CD nâng cao, security hardening (dependency scanning, secret management, CSP), scaling, load testing, backup/restore có diễn tập, recovery runbook.

---

**Không nằm trong roadmap:** giao dịch tiền thật, kết nối broker/prop firm, nạp/rút, AI "dự báo giá", copy trading.
