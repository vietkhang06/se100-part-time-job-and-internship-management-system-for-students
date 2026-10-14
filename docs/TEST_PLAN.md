# CAMPUSJOB — KẾ HOẠCH KIỂM THỬ (TEST PLAN)

## 1. Mục tiêu kiểm thử
Đảm bảo chất lượng hệ thống nền tảng CampusJob đạt độ tin cậy cao, không có hồi quy, kiểm thử trên môi trường thực tế (PostgreSQL container thật, không mock giả tạo kết quả).

## 2. Cấp độ kiểm thử

### 2.1 Unit Test
- Kiểm thử các thực thể nghiệp vụ (Domain Entities), value objects, utilities, helper functions độc lập.
- Framework: Jest.

### 2.2 Integration Test
- Kiểm thử tích hợp giữa Repository và PostgreSQL thực tế thông qua Prisma.
- Kiểm thử các use cases, validation rules, transactional boundary.
- Tuyệt đối không mock database trong integration test.

### 2.3 End-to-End (E2E) Test
- Kiểm thử toàn bộ luồng REST API từ HTTP request đến database thông qua Supertest.
- Xác nhận các HTTP Status code, format chuẩn `ApiErrorResponse`, header, cookie.
- Tối thiểu kiểm thử: Health check endpoint (`GET /api/v1/health`) xác nhận NestJS và PostgreSQL đều sẵn sàng.
- **Auth E2E (`apps/api/test/auth-flow.e2e-spec.ts`, task W1-QA-01):**
  - Happy path liền mạch chỉ qua HTTP: đăng ký → nhận email (bắt email tại transport, lấy token từ link trong email) → xác minh → đăng nhập → `/me` → refresh (rotate) → logout → refresh bị từ chối.
  - Error path: email trùng, dữ liệu đăng ký không hợp lệ, token xác minh sai/hết hạn/đã dùng, mật khẩu sai, access token sai/giả mạo/hết hạn, refresh token sai/hết hạn/bị dùng lại/sau logout, logout & logout-all.
  - Email được bắt trong process nên không cần Mailpit/SMTP trong CI.

### 2.4 Static Analysis & Type Checking
- `pnpm lint`: Đảm bảo quy tắc mã nguồn nhất quán.
- `pnpm typecheck`: TypeScript compiler kiểm tra kiểu nghiêm ngặt (strict mode).
- `pnpm build`: Đảm bảo ứng dụng compile thành công không cảnh báo nghiêm trọng.

## 3. Tiêu chí Pass/Fail
- Tất cả unit tests và E2E tests phải pass 100%.
- Không có lỗi typecheck TypeScript (`tsc --noEmit`).
- Không có lỗi ESLint (`eslint`).
- Docker Compose healthcheck phải trả về `healthy` trước khi chạy E2E tests.
