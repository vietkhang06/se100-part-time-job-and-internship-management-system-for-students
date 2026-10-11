# CAMPUSJOB — MA TRẬN MÃ LỖI XÁC THỰC (AUTH ERROR MATRIX)

Tài liệu này xác định ma trận ánh xạ chính thức giữa tình huống lỗi nghiệp vụ, mã trạng thái HTTP, mã lỗi ứng dụng (`AuthErrorCode`), thông điệp phản hồi và định dạng payload chuẩn `ApiErrorResponse` cho phân hệ xác thực (C-01).

---

## 1. Bảng ma trận mã lỗi chi tiết (Confirmed Behavior)

| Mã lỗi ứng dụng (`code`) | HTTP Status | Exception Class | Điều kiện kích hoạt | Thông điệp phản hồi (`message`) | Kiểm thử tự động bảo đảm | Trạng thái nghiệm thu |
|---|---|---|---|---|---|---|
| `VALIDATION_ERROR` | `400 Bad Request` | `BadRequestException` | Dữ liệu đầu vào sai định dạng DTO | Mảng thông báo cụ thể từ `class-validator` | `auth.e2e-spec.ts` (test invalid email) | **Verified (PASS)** |
| `ROLE_DISALLOWED` | `400 Bad Request` | `BadRequestException` | Đăng ký tự do vai trò `ADMIN` / `MODERATOR` | `"Only STUDENT and EMPLOYER roles are permitted for self-registration"` | `auth.e2e-spec.ts` (test ADMIN/MODERATOR) | **Verified (PASS)** |
| `WEAK_PASSWORD` | `400 Bad Request` | `BadRequestException` | Mật khẩu không thỏa mãn độ phức tạp Argon2id | `"Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."` | `auth.e2e-spec.ts` (test weakpass) | **Verified (PASS)** |
| `EMAIL_ALREADY_EXISTS` | `409 Conflict` | `ConflictException` | Đăng ký email đã tồn tại (không phân biệt hoa/thường) | `"Email is already registered"` | `auth.e2e-spec.ts` (test duplicate email) | **Verified (PASS)** |
| `INVALID_CREDENTIALS` | `401 Unauthorized` | `UnauthorizedException` | Đăng nhập sai mật khẩu hoặc email không tồn tại | `"Email hoặc mật khẩu không chính xác."` | `auth.e2e-spec.ts` (test wrong pass & unknown email) | **Verified (PASS)** |
| `ACCOUNT_PENDING_VERIFICATION` | `403 Forbidden` | `ForbiddenException` | Đăng nhập tài khoản chưa kích hoạt email | `"Tài khoản chưa được xác minh email. Vui lòng kiểm tra email để kích hoạt hoặc yêu cầu gửi lại mã."` | `auth.e2e-spec.ts` (test unverified user) | **Verified (PASS)** |
| `ACCOUNT_SUSPENDED` | `403 Forbidden` | `ForbiddenException` | Đăng nhập hoặc refresh tài khoản bị đình chỉ | `"Tài khoản đã bị đình chỉ hoạt động."` / `"Tài khoản không hợp lệ hoặc đã bị khóa."` | `auth.e2e-spec.ts` (test suspended login & refresh) | **Verified (PASS)** |
| `ACCOUNT_LOCKED` | `403 Forbidden` | `ForbiddenException` | Đăng nhập tài khoản đang bị khóa tạm thời | `"Tài khoản đang bị khóa tạm thời. Vui lòng liên hệ quản trị viên."` | `auth.e2e-spec.ts` (test locked user login) | **Verified (PASS)** |
| `REFRESH_TOKEN_MISSING` | `401 Unauthorized` | `UnauthorizedException` | Gọi `/auth/refresh` không có cookie/header | `"Không tìm thấy refresh token."` | `auth.e2e-spec.ts` (test missing refresh cookie) | **Verified (PASS)** |
| `REFRESH_TOKEN_INVALID` | `401 Unauthorized` | `UnauthorizedException` | Refresh token không tồn tại trong bảng `AuthSession` | `"Phiên đăng nhập không hợp lệ hoặc đã hết hạn."` | `auth.e2e-spec.ts` (test non-existent cookie) | **Verified (PASS)** |
| `REFRESH_TOKEN_EXPIRED` | `401 Unauthorized` | `UnauthorizedException` | Refresh session trong cơ sở dữ liệu đã hết hạn | `"Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."` | `auth.e2e-spec.ts` (test expired session in DB) | **Verified (PASS)** |
| `REFRESH_TOKEN_REUSED` | `401 Unauthorized` | `UnauthorizedException` | Tái sử dụng token cũ đã bị thu hồi (`revokedAt != null`) | `"Phát hiện hành vi sử dụng lại token đã thu hồi. Tất cả phiên đăng nhập liên quan đã bị hủy."` | `auth.e2e-spec.ts` (test token family reuse attack) | **Verified (PASS)** |
| `UNAUTHORIZED` | `401 Unauthorized` | `UnauthorizedException` | Gọi endpoint bảo vệ JWT (`/logout-all`, `/me`) không có token / sai token | `"Unauthorized"` | `auth.e2e-spec.ts` (test unauthenticated / malformed token) | **Verified (PASS)** |

---

## 2. Cấu trúc Payload phản hồi mẫu

### 2.1 Lỗi Validation (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": [
    "Invalid email address",
    "Password must be at least 8 characters long"
  ],
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "timestamp": "2026-10-11T07:30:00.000Z",
  "path": "/api/v1/auth/register",
  "correlationId": "488821ca-d339-4f4f-bd04-f9a5e7744601"
}
```

### 2.2 Lỗi Trùng Email (409 Conflict)
```json
{
  "statusCode": 409,
  "message": "Email is already registered",
  "error": "Conflict",
  "code": "EMAIL_ALREADY_EXISTS",
  "timestamp": "2026-10-11T07:30:00.000Z",
  "path": "/api/v1/auth/register",
  "correlationId": "488821ca-d339-4f4f-bd04-f9a5e7744601"
}
```

### 2.3 Lỗi Sai thông tin đăng nhập (401 Unauthorized)
```json
{
  "statusCode": 401,
  "message": "Email hoặc mật khẩu không chính xác.",
  "error": "Unauthorized",
  "code": "INVALID_CREDENTIALS",
  "timestamp": "2026-10-11T07:30:00.000Z",
  "path": "/api/v1/auth/login",
  "correlationId": "488821ca-d339-4f4f-bd04-f9a5e7744601"
}
```

### 2.4 Lỗi Tài khoản chưa kích hoạt (403 Forbidden)
```json
{
  "statusCode": 403,
  "message": "Tài khoản chưa được xác minh email. Vui lòng kiểm tra email để kích hoạt hoặc yêu cầu gửi lại mã.",
  "error": "Forbidden",
  "code": "ACCOUNT_PENDING_VERIFICATION",
  "timestamp": "2026-10-11T07:30:00.000Z",
  "path": "/api/v1/auth/login",
  "correlationId": "488821ca-d339-4f4f-bd04-f9a5e7744601"
}
```

### 2.5 Lỗi Tấn công tái sử dụng Token (401 Unauthorized)
```json
{
  "statusCode": 401,
  "message": "Phát hiện hành vi sử dụng lại token đã thu hồi. Tất cả phiên đăng nhập liên quan đã bị hủy.",
  "error": "Unauthorized",
  "code": "REFRESH_TOKEN_REUSED",
  "timestamp": "2026-10-11T07:30:00.000Z",
  "path": "/api/v1/auth/refresh",
  "correlationId": "488821ca-d339-4f4f-bd04-f9a5e7744601"
}
```

---

## 3. Cách Frontend tiếp nhận và xử lý lỗi

Trong `apps/web/src/lib/api-client.ts`, mọi phản hồi có `!response.ok` được parse thành `ApiErrorResponse` và bọc trong ngoại lệ `ApiClientError`:

- Nếu `message` là mảng (validation), `ApiClientError.message` tự động join thành chuỗi ngăn cách bởi dấu phẩy.
- Hàm trợ giúp `getAuthErrorMessage(error, fallback)` trong `apps/web/src/lib/auth-context.tsx` phân loại:
  - `status === 401`: Ưu tiên trả về thông điệp thân thiện *"Email hoặc mật khẩu không chính xác."*
  - `status === 403`: Lấy trực tiếp `error.message` từ Backend để hiển thị nguyên nhân tài khoản chưa xác thực hoặc bị khóa.
  - `status === 429`: Hiển thị *"Bạn thao tác quá nhanh. Vui lòng thử lại sau."*
  - Các lỗi khác: Sử dụng `error.message` nếu có hoặc fallback mặc định.

---

## 4. Kế hoạch Chuyển giao Kỹ thuật (Technical Transition)

- Toàn bộ 13/13 mã lỗi trong Ma trận đã được hiện thực hóa ở Backend (`apps/api`), định nghĩa kiểu mẫu tại `@campusjob/contracts`, tích hợp an toàn trên Frontend (`apps/web`), và kiểm chứng qua bộ kiểm thử E2E tự động (`apps/api/test/auth.e2e-spec.ts`).
- **Nhiệm vụ kế tiếp:** **`S2-M01-02` (Phân quyền người dùng & Kiểm soát truy cập dựa trên vai trò - RBAC - Role-Based Access Control)**. Nhiệm vụ này phụ thuộc trực tiếp vào C-01 và **không phải** là nhiệm vụ hồ sơ cá nhân. Không triển khai S2-M01-02 trong phạm vi task hiện tại.

