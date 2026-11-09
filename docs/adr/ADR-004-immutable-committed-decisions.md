# ADR-004: Quyết định đã commit là bất biến

- **Trạng thái:** Accepted (v0.1)
- **Ngày:** 2026-11-09

## Context

Pillar B — Sealed Decision. Giá trị của việc luyện tập nằm ở chỗ quyết định được ghi lại *trước* khi biết kết quả. Nếu sửa được sau đó (dù chỉ "sửa chính tả"), dữ liệu học tập mất tính trung thực và hindsight bias quay lại.

## Decision

- Một hàng trong `decisions` **là** một quyết định đã commit; v0.1 không có bản nháp.
- Một user một quyết định mỗi round: `UNIQUE (round_id, user_id)`.
- Ứng dụng chỉ có `insertDecision`; không có hàm/endpoint update hay delete.
- Trigger `BEFORE UPDATE` / `BEFORE DELETE` trên `decisions` (và `audit_events`) báo lỗi — chặn cả bug trong code tương lai.
- Nhận xét sau này là bản ghi riêng (`reviews`), không ghi đè quyết định.
- Trong `DECISION_OPEN`, nội dung quyết định của người khác bị ẩn; chỉ hiển thị "đã commit".

## Alternatives

1. Cho sửa đến khi lock: nghe tiện nhưng tạo động cơ "đợi xem người khác rồi sửa".
2. Versioning (lưu lịch sử sửa): phức tạp, vẫn làm mờ "quyết định thật là gì".
3. Chỉ chặn ở application: một câu SQL sai trong tương lai có thể phá dữ liệu.

## Tradeoffs

- (+) Dữ liệu học tập đáng tin; dễ giải thích.
- (−) Gõ nhầm là không sửa được → UI hỏi xác nhận trước khi commit.
- (−) Trigger không phải bảo mật tuyệt đối: DBA có thể xoá trigger. Đây là bảo vệ chống bug, không chống người có quyền admin DB.

## Consequences

- Muốn có "draft" trong tương lai: bảng riêng `decision_drafts`, không đổi bảng `decisions`.
- Test: `TestCommittedDecisionIsImmutable`, `TestConcurrentDuplicateDecision`.
