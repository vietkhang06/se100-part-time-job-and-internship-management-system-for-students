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

### 2.4 Static Analysis & Type Checking
- `pnpm lint`: Đảm bảo quy tắc mã nguồn nhất quán.
- `pnpm typecheck`: TypeScript compiler kiểm tra kiểu nghiêm ngặt (strict mode).
- `pnpm build`: Đảm bảo ứng dụng compile thành công không cảnh báo nghiêm trọng.

## 3. Tiêu chí Pass/Fail
- Tất cả unit tests và E2E tests phải pass 100%.
- Không có lỗi typecheck TypeScript (`tsc --noEmit`).
- Không có lỗi ESLint (`eslint`).
- Docker Compose healthcheck phải trả về `healthy` trước khi chạy E2E tests.
