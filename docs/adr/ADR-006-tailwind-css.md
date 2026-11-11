# ADR-006: Sử dụng Tailwind CSS v4 cho Frontend

- **Trạng thái:** Accepted (v0.1)
- **Ngày:** 2026-11-11

## Context

Frontend của MARKET FORGE cần được phát triển từ bản giao diện tối thiểu hiện tại thành giao diện **Trading Dojo** hoàn chỉnh (dark theme kiểu trading terminal, responsive tới 360px, nhiều trạng thái Loading / Empty / Error / Success cho 4 màn hình chính). Việc mở rộng UI chỉ bằng một file CSS thuần (`styles.css`) dễ dẫn đến trùng lặp class và khó bảo trì khi nhiều thành viên cùng làm việc trên các component.

## Decision

- Thêm **Tailwind CSS v4** (`tailwindcss` và `@tailwindcss/vite`, license **MIT**, dev/build-time dependency) vào `frontend/`.
- Tích hợp qua Vite plugin trong `frontend/vite.config.ts` và khai báo `@import 'tailwindcss';` ở đầu `frontend/src/styles.css`.
- Giữ nguyên các biến CSS `:root` và các class hiện có trong `frontend/src/styles.css` để tương thích ngược, cho phép nâng cấp từng component qua các PR nhỏ mà không làm vỡ giao diện hiện tại.

## Alternatives

1. **Giữ CSS thuần (`styles.css`):** Không thêm dependency, nhưng tốn thời gian đặt tên class và dễ xung đột khi tách nhiều component phức tạp.
2. **Tailwind CSS v3 (`tailwindcss@^3` + `postcss` + `autoprefixer`):** Cần thêm `tailwind.config.js` và `postcss.config.js`, cấu hình nhiều file hơn so với v4 trên Vite.
3. **CSS-in-JS (styled-components, Emotion):** Phát sinh runtime overhead và không phù hợp với quy ước code của dự án.
4. **Component library lớn (MUI, Ant Design):** Kích thước bundle lớn, khó tuỳ biến sát phong cách dark trading terminal tối giản.

## Tradeoffs

- (+) Viết và đọc style ngay tại component (colocation), chỉ những class thực sự dùng mới được đưa vào file CSS khi build production.
- (+) License MIT, không thêm runtime JS vào bundle gửi xuống trình duyệt.
- (−) Tăng thêm devDependency trong `node_modules` và bước xử lý CSS lúc build.
- (−) Class string trên JSX có thể dài nếu không tách component hợp lý.

## Consequences

- Mọi PR frontend sử dụng Tailwind CSS vẫn phải tuân thủ nghiêm ngặt luật **F1–F15** trong `READ_FIRST.md` (đặc biệt F10 về nhãn synthetic data và F15 về responsive 360px, không animation phức tạp).
