# ADR-002: MariaDB là nơi lưu trạng thái giao dịch duy nhất

- **Trạng thái:** Accepted (v0.1)
- **Ngày:** 2026-11-09

## Context

Trạng thái trial/round/decision phải sống sót qua restart, và các thao tác đồng thời (nhiều người commit, owner lock) phải nhất quán. Owner đã thành thạo SQL/MariaDB.

## Decision

- MariaDB 11.4 (InnoDB) là nguồn sự thật cho **mọi** trạng thái nghiệp vụ, kể cả session và idempotency key.
- Invariant được bảo vệ ở **database** khi có thể: `UNIQUE`, `FOREIGN KEY`, `CHECK`, cột sinh + `UNIQUE`, trigger chặn UPDATE/DELETE.
- Concurrency dùng **row lock** (`SELECT … FOR UPDATE`) với thứ tự khoá cố định, không dùng mutex trong Go.
- Migration SQL đánh số, nhúng vào binary, có checksum, forward-only.
- Giá lưu BIGINT ticks, không floating-point.

## Alternatives

1. **SQLite**: đơn giản nhưng ghi đồng thời bị khoá cả file; khác xa môi trường production.
2. **PostgreSQL**: rất tốt (transactional DDL, partial index), nhưng owner quen MariaDB và đề bài chọn MariaDB.
3. **Trạng thái trong bộ nhớ Go + lưu định kỳ**: mất dữ liệu khi crash, không chạy được nhiều instance.
4. **Redis**: thêm thành phần, không có transaction quan hệ.

## Tradeoffs

- (+) Constraint của DB đúng trong mọi trường hợp, kể cả khi code có bug hay có nhiều process.
- (+) Test integration chạy trên DB thật bắt được lỗi mà mock không bắt được.
- (−) DDL của MariaDB tự commit → migration không nguyên tử.
- (−) Không có partial unique index → dùng mẹo cột sinh `IF(..., id, NULL)`.
- (−) Trigger cần lưu ý quyền khi bật binary logging.

## Consequences

- Mọi thay đổi schema đi qua migration mới.
- Test integration cần một MariaDB riêng (`*_test`), CI dùng service container.
