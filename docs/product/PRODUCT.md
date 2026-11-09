# MARKET FORGE — Product Brief

**Product:** MARKET FORGE · **Core experience:** The Trading Dojo · **Tagline:** *Train the decision. Not just the trade.*

## Là gì / không là gì

MARKET FORGE là **nền tảng luyện ra quyết định**, dùng thị trường làm môi trường thực hành.

Không phải: hệ thống dự báo giá, bot kiếm tiền, sàn giao dịch, công cụ copy trade, hay bằng chứng về hiệu suất trading thật.

## Người dùng đầu tiên

3–6 trader/lập trình viên học trading cùng nhau, muốn thực hành, phản biện và cải thiện cách ra quyết định trên **cùng một** phiên thị trường.

## Bốn pillar

| Pillar | Ý nghĩa | v0.1 hiện thực bằng |
|---|---|---|
| A — Blind Practice | Không ai thấy nến vượt mốc server cho phép | Replay clock do server giữ, seed bí mật |
| B — Sealed Decision | Quyết định được lưu trước khi mở kết quả, không sửa đè | Decision bất biến, ẩn nội dung đến khi lock |
| C — Evidence-Based Review | Đánh giá kế hoạch dựa trên thông tin có tại thời điểm quyết định | Blind review chỉ trong `REVIEW_BLIND`, checklist 4 tiêu chí |
| D — Learning Progress | Lưu lịch sử để làm báo cáo tiến bộ sau này | Decision, review, audit event lưu đầy đủ, có `known_at_clock_index` |

## Vòng luyện tập (một round)

1. Mọi người nhìn cùng một chart giả lập tới thời điểm hiện tại.
2. Mỗi người commit **LONG / SHORT / WAIT** + thesis + invalidation + confidence (+ risk note).
3. Owner **lock**. Quyết định hiện ra; mọi người review chéo **mù**.
4. Owner **reveal** 30 nến tiếp theo. Cả nhóm thấy thị trường đã đi thế nào.
5. Owner **complete**; round tiếp theo bắt đầu ở thời điểm mới.

## An toàn sản phẩm

- Mọi giá v0.1 là **giả lập** và được gắn nhãn `SYNTHETIC MARKET DATA — NOT REAL NAS100` trên chart, API và footer.
- Không tính P&L: không giả định phí/spread/slippage bằng 0 — chúng **không được mô hình hoá**, và UI nói rõ như vậy.
- Không kết nối bất kỳ dịch vụ giao dịch thật nào.
- Frontend không thể tự thay đổi trạng thái nghiệp vụ; server kiểm tra mọi thứ.

## Thứ tự ưu tiên khi đánh đổi

Correctness → Data integrity → Reproducibility → Security → Maintainability → Learning value → UX → Performance (dựa trên đo lường).
