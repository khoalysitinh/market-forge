# Đóng góp cho MARKET FORGE

## Quy trình

1. Mỗi việc là một GitHub Issue có **acceptance criteria**.
2. Tạo nhánh từ `main`: `feat/<mô-tả-ngắn>`, `fix/...`, `docs/...`, `test/...`, `chore/...`.
3. Commit theo **Conventional Commits**: `feat(trials): ...`, `fix(identity): ...`, `docs: ...`, `test: ...`.
4. Mở Pull Request vào `main`. CI phải xanh. Ít nhất một người khác review.
5. Không tự merge PR của chính mình khi chưa có review. Không force-push lên `main`.

## Checklist cho mỗi PR

- [ ] `gofmt -l backend` rỗng, `go vet ./...` sạch.
- [ ] `go test ./...` và integration test pass (ghi lệnh đã chạy vào mô tả PR).
- [ ] Nếu thay đổi schema: **migration mới** (không sửa file cũ), có constraint/index phù hợp.
- [ ] Nếu thay đổi API: cập nhật [docs/api/API.md](docs/api/API.md).
- [ ] Nếu thay đổi kiến trúc: thêm ADR trong [docs/adr/](docs/adr/).
- [ ] Không có secrets, `.env`, dump DB, `node_modules`, build output.
- [ ] Có test bảo vệ hành vi mới (đặc biệt invariant trong [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md#4-core-invariants)).

## Quy ước code (Go)

- Handler → Service → Repository. Handler không chứa SQL; repository không biết HTTP.
- Lỗi nghiệp vụ dùng `apperr.New(kind, CODE, message)`; lỗi khác được bọc bằng `fmt.Errorf("...: %w", err)`.
- Không nuốt lỗi (`_ = err` chỉ khi có comment giải thích).
- SQL luôn dùng placeholder `?`. Không nối chuỗi từ input.
- Mọi thay đổi trạng thái + audit event nằm trong **một** `database.WithTx`. Thứ tự khoá: idempotency → round → trial → room.
- Không giữ transaction trong khi gọi dịch vụ bên ngoài hoặc chờ người dùng.
- Không dùng biến global để giữ trạng thái nghiệp vụ.

## Quy ước code (Frontend)

- Server là nguồn sự thật: UI không tự quyết định trạng thái round hay giá.
- Mỗi màn hình có trạng thái Loading / Error / Empty.
- Mutation tạo bản ghi gửi `Idempotency-Key` (một key cho một hành động người dùng).
