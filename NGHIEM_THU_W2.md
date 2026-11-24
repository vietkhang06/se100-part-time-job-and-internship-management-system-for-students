# Nghiệm thu đối chiếu bảng task tuần 2 — 20/11/2026

## Phạm vi

Nguồn đối chiếu: sheet “ĐỒ ÁN CUỐI KỲ”, dòng 34–48 của bảng phân công; mô tả nghiệp vụ PDF; source code trong gói ZIP ngày 18/11/2026. Bảng ghi 15 việc “Chưa làm” nhưng bản mã nguồn có nhiều phần đã triển khai về sau. Không đổi trạng thái bảng khi chưa đủ chứng cứ nghiệm thu.

| Task | Kết quả đối chiếu |
| --- | --- |
| W2-BE-01, W2-BE-02 | Có module Students, CV, validation, quản lý file và test; chưa xác nhận toàn bộ bằng E2E PostgreSQL. |
| W2-BE-03 | Có API hồ sơ và CRUD chi nhánh, kiểm tra quyền theo doanh nghiệp. |
| W2-BE-04 | Có tạo và xét duyệt hồ sơ xác thực, kiểm tra tài liệu/lý do từ chối; **lệch tác nhân**: endpoint quyết định chỉ cho Admin, còn bảng yêu cầu Moderator. Chưa tìm thấy endpoint hàng đợi xác minh. |
| W2-BE-05 | Có JWT/role guards và ownership tại nhiều use case; chưa có bằng chứng rà soát phủ hết endpoint. |
| W2-FE-01, W2-FE-02 | Có giao diện Candidate profile/CV gọi API; cần xác nhận thao tác thực tế qua trình duyệt và DB. |
| W2-FE-03 | Bổ sung trong bản giao này: trang Employer company tạo/cập nhật hồ sơ và trang branches liệt kê/tạo/sửa/xóa qua API, có trạng thái tải/lỗi và kiểm tra trường cơ bản. **Mới đạt một phần** vì chưa có giao diện quản lý CompanyMember. |
| W2-FE-04 | Chưa đạt: chưa có luồng tải giấy phép, hàng đợi xét duyệt hoặc màn hình xác minh riêng cho Employer/Moderator. |
| W2-DO-02 | Chưa đạt: môi trường kiểm tra không có Docker/PostgreSQL/Mailpit, không thể xác nhận chạy migration từ DB rỗng. |
| W2-QA-01, W2-QA-02 | Có nhiều unit/integration/E2E spec trong `apps/api/test` và ma trận M02; chưa xác nhận bộ integration trên DB thật. |
| W2-INT-01 | Typecheck/lint/build đạt sau khi generate Prisma. Chưa có merge PR hoặc kiểm thử tích hợp browser/database. |
| W2-DOC-01 | Có tài liệu API, RBAC, schema/migration, test matrix; cần cập nhật hướng dẫn đầy đủ cho thay đổi UI và luồng xác minh. |
| W2-REVIEW-01 | Chưa đạt: chưa thể demo và nghiệm thu xuyên vai trò trên môi trường chạy thật. |

## Kiểm tra thực hiện

- `pnpm install --frozen-lockfile`: đạt.
- `DATABASE_URL=postgresql://test:test@localhost:5435/test pnpm db:generate`: đạt; URL chỉ dùng generate client, không khẳng định đã kết nối DB.
- `pnpm typecheck`: đạt cả contracts, API và web.
- `pnpm lint`: đạt (0 lỗi, API còn 101 cảnh báo có sẵn).
- `pnpm build`: đạt cả contracts, API và web.
- `pnpm test` khi chưa cấu hình biến môi trường: 85/87 suite qua, 700/705 ca qua; 5 ca bootstrap từ chối JWT secret trống.
- `JWT_ACCESS_SECRET='integration-only-secret-for-isolated-unit-tests-2026' pnpm --filter @campusjob/api exec jest --config jest.config.js --runInBand --silent`: 87/87 suite và 705/705 ca đạt. Một số suite có nhánh bỏ qua khi không có scratch DB; con số này **không thay thế** E2E trên PostgreSQL.

## Việc cần giải quyết trước khi ký nghiệm thu toàn bộ

1. Thống nhất người xét duyệt doanh nghiệp: bảng ghi Moderator, code chỉ Admin; cập nhật một trong hai theo quyết định nhóm và kiểm thử quyền tương ứng.
2. Bổ sung API xem hàng đợi xác minh, upload tài liệu pháp lý, màn hình Employer/Moderator hoặc Admin tương ứng, cùng audit/kiểm soát cập nhật đồng thời.
3. Hoàn thiện CompanyMember UI và test thực tế các trang mới với tài khoản Employer.
4. Chạy migration từ PostgreSQL mới, E2E auth → profile → CV → company → verification và demo theo ba vai trò; ghi kết quả vào bảng task sau khi có bằng chứng.
