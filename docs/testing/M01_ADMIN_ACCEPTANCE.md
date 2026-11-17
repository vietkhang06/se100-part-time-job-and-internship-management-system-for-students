# Nghiệm thu M01 · SE100 CampusJob

## Trạng thái theo bảng phân công

| Task | Bằng chứng trong source |
|---|---|
| S3-M01-02 | Đã có account context và refresh session. Các suite `auth-flow`, `account-state` và `account-integration` bao phủ các luồng hiện hành. Suite `auth-flow` có TODO về access token sau logout thông thường. |
| S3-M01-03 | Đã có `GET /users/:id` giới hạn chủ tài khoản hoặc ADMIN. Suite `rbac` bao phủ 401, 403, 404 và danh sách field trả về. |
| S3-M01-04 | Dùng chung kiểm tra secret khi ký và xác thực JWT. Biến bắt buộc `JWT_ACCESS_SECRET` được mô tả ở README. |
| S6-M01-01 | API ADMIN có tra cứu, bộ lọc, phân trang, chi tiết tài khoản và thay đổi trạng thái. |
| S6-M01-02 | API ADMIN cấp, thu hồi MODERATOR và xử lý giao việc còn tồn theo hợp đồng API. |
| S7-M01-01 | Đổi trạng thái, cấp và thu hồi quyền ghi AuditLog cùng giao dịch, với metadata trước/sau. |
| S7-M01-02 | Kiểm thử trực tiếp AppModule với PostgreSQL cho M03, M04 và M05. |

## Chạy lại trên Windows PowerShell

Tại thư mục gốc, tạo `.env` nếu chưa có và điền `JWT_ACCESS_SECRET` theo README. Nếu đã có môi trường phát triển, cập nhật secret trong tệp hiện tại. Khởi động PostgreSQL và Mailpit bằng cấu hình của repo.

```powershell
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:deploy
pnpm db:generate
pnpm --filter @campusjob/contracts build
pnpm --filter @campusjob/api typecheck
pnpm --filter @campusjob/api build
```

E2E dùng tài khoản và dữ liệu kiểm thử có ghi vào DB. Dùng một database **kiểm thử riêng**, đã áp dụng migration và trỏ `DATABASE_URL` của tiến trình kiểm thử vào đó.

```powershell
$env:NODE_ENV = 'test'
$env:JWT_ACCESS_SECRET = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
# Thay URL dưới đây bằng database kiểm thử riêng đã migrate.
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5435/campusjob_test?schema=public'
pnpm --filter @campusjob/api test --runInBand
pnpm --filter @campusjob/api test:e2e
```

## Ma trận kiểm tra route thật

| Kịch bản | Bằng chứng |
|---|---|
| M03 · Saved jobs và metric tuyển dụng | `m03-session4-routes.e2e-spec.ts` kiểm 401, role đúng/sai, quyền trên tin của công ty khác. `m04-production.e2e-spec.ts` kiểm tài khoản SUSPENDED / LOCKED trên Saved Jobs. |
| M04 · Ứng tuyển và phỏng vấn | `m04-production.e2e-spec.ts` kiểm 401, role sai, body chèn `studentId`, CV khác chủ, hồ sơ khác chủ, truy cập ngoài công ty và tài khoản SUSPENDED / LOCKED. |
| M05 · Hàng đợi và thông báo | `admin-users.e2e-spec.ts` kiểm quyền hàng đợi trước/sau cấp/thu hồi MODERATOR, chặn sửa thông báo của người khác, chặn query chèn `userId`. `m04-production.e2e-spec.ts` kiểm SUSPENDED / LOCKED trên thông báo. |
| M01 · API Admin và AuditLog | `admin-users.e2e-spec.ts` kiểm quyền ADMIN, phân trang, DTO, trạng thái, session, 2 request đổi trạng thái cùng lúc, role gốc và dữ liệu audit. |

Ba suite dùng AppModule liệt kê ở ma trận chạy route, guard và persistence thật. Các suite `m04-contract` và `m05-trust-integration` có adapter thử nghiệm cho một số phụ thuộc và là bằng chứng bổ sung.

Có thể kiểm thử tay trong Swagger ở `http://localhost:8080/docs`. Đăng nhập bằng tài khoản ADMIN, dán access token qua Authorize rồi làm theo [hợp đồng Admin Users](../api/ADMIN_USERS_API_CONTRACT.md). Khi thử đình chỉ và mở lại, đăng nhập tài khoản thử nghiệm trước và lưu cả access token lẫn cookie. Sau khi mở lại, thử token cũ rồi đăng nhập mới để đối chiếu.

Frontend `/admin/users` hiện hiển thị trang khung. Trong bảng phân công, S6-M01-01 và S6-M01-02 có đầu ra là API. Nếu cần nghiệm thu UI, tạo task nối trang quản trị với các API sau khi merge.
