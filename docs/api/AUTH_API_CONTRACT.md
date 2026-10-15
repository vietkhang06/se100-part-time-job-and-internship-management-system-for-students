# CAMPUSJOB — HỢP ĐỒNG API XÁC THỰC (AUTH API CONTRACT C-01)

Tài liệu này chuẩn hóa hợp đồng giao tiếp API xác thực (Authentication API Contract) cho hệ thống CampusJob, đóng vai trò nguồn chân lý (Single Source of Truth) giữa Backend (`apps/api`), Frontend (`apps/web`), và gói hợp đồng dùng chung (`packages/contracts`).

---

## 1. Tiêu chuẩn chung

- **Base URL:** `/api/v1`
- **Format dữ liệu:** `application/json; charset=utf-8`
- **Mã hóa mật khẩu:** Argon2id (`memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`)
- **Access Token:** Bearer JWT, thời hạn 15 phút, gửi qua header `Authorization: Bearer <accessToken>`. Được lưu trữ trong in-memory/RAM ở client, không lưu trong localStorage/sessionStorage.
- **Refresh Token & Session:** Token ngẫu nhiên (40 bytes hex), băm SHA-256 lưu trong cơ sở dữ liệu (`AuthSession`), thời hạn mặc định 30 ngày.
- **Cơ chế Cookie:** Gửi qua `Set-Cookie` với cấu hình:
  - Tên cookie: `campusjob_refresh_token` (dự phòng tương thích: `refreshToken`)
  - Thuộc tính: `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Secure` (bật khi production hoặc `COOKIE_SECURE=true`), `Max-Age=2592000` (30 ngày).
- **Cơ chế Token Rotation & Reuse Detection:** Mỗi lần refresh, refresh token cũ được thu hồi (`revokedAt = now`) và cấp refresh token mới cùng `tokenFamily`. Nếu phát hiện refresh token đã bị thu hồi được sử dụng lại (tấn công đánh cắp token), toàn bộ phiên thuộc `tokenFamily` sẽ bị thu hồi ngay lập tức.
- **Chuẩn định dạng lỗi:** `ApiErrorResponse` (`packages/contracts`):
  ```json
  {
    "statusCode": 400,
    "message": "Chi tiết lỗi hoặc mảng lỗi validation",
    "error": "Bad Request",
    "code": "VALIDATION_ERROR",
    "timestamp": "2026-10-11T00:00:00.000Z",
    "path": "/api/v1/auth/register",
    "correlationId": "optional-uuid"
  }
  ```

### 1.1 Chuẩn hóa Ngữ cảnh Xác thực Liên phân hệ (AuthContext C-01)

Nhằm đảm bảo các module tiêu thụ danh tính (Student Profile & CV, Application & Interview, Notifications) nhận ngữ cảnh xác thực chuẩn tắc mà không phụ thuộc trực tiếp vào triển khai nội bộ của M01, `AuthContext` được xuất bản chính thức trong `@campusjob/contracts` và kết nối trực tiếp với kết quả giải mã token của `JwtStrategy.validate`:

#### Bảng cấu trúc trường dữ liệu `AuthContext`:
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả & Ý nghĩa hợp đồng |
|---|---|---|---|
| `id` | `string` (UUID) | Có | **Định danh người dùng chuẩn tắc (Canonical Authenticated User ID)**. Ánh xạ trực tiếp từ `payload.sub` và thẩm định qua `userRepository.findById`. Gắn trên `req.user.id`. Toàn bộ module tiêu thụ trích xuất qua `@CurrentUser('id')`. |
| `email` | `string` | Có | Địa chỉ email đã đăng ký của tài khoản. |
| `fullName` | `string` | Có | Họ và tên hiển thị của người dùng. |
| `role` | `UserRole` | Có | Vai trò người dùng theo phân quyền RBAC (`STUDENT`, `EMPLOYER`, `MODERATOR`, `ADMIN`). |
| `status` | `UserStatus` | Có | Trạng thái tài khoản (`ACTIVE`, `SUSPENDED`, `LOCKED`, `PENDING_VERIFICATION`). |
| `phone` | `string \| null` | Không | Số điện thoại liên hệ của người dùng (tùy chọn). |
| `emailVerified` | `boolean` | Có | Cờ xác nhận địa chỉ email đã được kích hoạt thành công (`user.isVerified()`). |
| `sessionId` | `string` | Không | Định danh phiên làm việc `AuthSession` gắn kèm token. |

#### Nguyên tắc Định danh & Ủy quyền trong Sprint 2:
1. **Định danh chuẩn tắc (Canonical User ID):** `req.user.id` là trường định danh chuẩn tắc duy nhất trong runtime. Không thêm bí danh `userId` trên `AuthContext` để tránh dư thừa và bảo toàn tính toàn vẹn.
2. **Chống can thiệp danh tính (Anti-Spoofing):** Mọi module tiêu thụ bắt buộc phải lấy danh tính người dùng từ token đã xác thực (`@CurrentUser('id')`), tuyệt đối không tin cậy hay cho phép trường `userId` trong request body/params ghi đè lên danh tính này.
3. **Mô hình Phân quyền Sprint 2:** Hệ thống thực thi ủy quyền thông qua:
   - **RBAC (Role-Based Access Control):** Kiểm tra vai trò qua `RolesGuard` và `@Roles(...)`.
   - **Resource Ownership:** So khớp quyền sở hữu tài nguyên qua `req.user.id` với trường quan hệ trong cơ sở dữ liệu (ví dụ: `studentId`, `userId`, `employerId`).
   - **Account State:** Từ chối ngay lập tức các tài khoản `SUSPENDED`, `LOCKED`, hoặc `PENDING_VERIFICATION` tại tầng Guard/Strategy.
4. **Quy định về Permissions:** Hợp đồng C-01 trong Sprint 2 **không chứa mảng `permissions: string[]`** trong runtime và không giới thiệu permission registry phân mảnh. Mọi mô hình fine-grained permissions trong tương lai bắt buộc phải thông qua quyết định hợp đồng (RFC/Contract Decision) riêng biệt và được phê duyệt chính thức.

---

## 2. Chi tiết các Endpoint trong phạm vi C-01

### 2.1 Đăng ký tài khoản (User Registration)

- **Endpoint:** `POST /api/v1/auth/register`
- **Yêu cầu xác thực:** Public (Không yêu cầu token)
- **Mô tả:** Đăng ký tài khoản mới dành cho Sinh viên (`STUDENT`) hoặc Doanh nghiệp (`EMPLOYER`). Tài khoản khởi tạo với trạng thái `PENDING_VERIFICATION`, đồng thời tạo token xác minh email (thời hạn 24 giờ) và gửi email kích hoạt qua Mailpit/SMTP.

#### Request Header
```http
Content-Type: application/json
```

#### Request Body (`RegisterRequestDto`)
| Trường | Kiểu dữ liệu | Bắt buộc | Ràng buộc validation | Mô tả |
|---|---|---|---|---|
| `email` | `string` | Có | Chuẩn email RFC 5322, tự động lowercase & trim | Email đăng nhập |
| `password` | `string` | Có | Tối thiểu 8 ký tự, gồm ít nhất: 1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt (`@$!%*?&`) | Mật khẩu tài khoản |
| `fullName` | `string` | Có | Tối thiểu 2 ký tự, tự động trim | Họ và tên người dùng |
| `role` | `string` | Có | Giá trị chỉ cho phép: `STUDENT` hoặc `EMPLOYER` | Vai trò người dùng |
| `phone` | `string` | Không | Chuỗi ký tự số điện thoại (tùy chọn) | Số điện thoại liên hệ |

*Ví dụ Request Body:*
```json
{
  "email": "student@example.com",
  "password": "Password123!",
  "fullName": "Nguyen Van A",
  "role": "STUDENT",
  "phone": "0901234567"
}
```

#### Success Response
- **HTTP Status:** `201 Created`
- **Body (`RegisterResponseDto`):**
```json
{
  "message": "Registration successful. Please check your email to verify your account.",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "student@example.com",
    "fullName": "Nguyen Van A",
    "role": "STUDENT",
    "status": "PENDING_VERIFICATION",
    "emailVerified": false
  }
}
```

#### Expected Error Responses
- **400 Bad Request (`VALIDATION_ERROR`):** Dữ liệu không thỏa mãn DTO hoặc mật khẩu không đạt chính sách phức tạp.
- **400 Bad Request (`ROLE_DISALLOWED`):** Cố tình gửi vai trò `ADMIN` hoặc `MODERATOR` qua API tự đăng ký.
- **409 Conflict (`EMAIL_ALREADY_EXISTS`):** Email đã tồn tại trong hệ thống (kiểm tra không phân biệt chữ hoa/thường).

---

### 2.2 Đăng nhập (User Login)

- **Endpoint:** `POST /api/v1/auth/login`
- **Yêu cầu xác thực:** Public (Không yêu cầu token)
- **Mô tả:** Xác thực người dùng bằng email và mật khẩu. Khi thành công, trả về Access Token trong body và gắn Refresh Token an toàn trong HttpOnly Cookie.

#### Request Header
```http
Content-Type: application/json
```

#### Request Body (`LoginRequestDto`)
| Trường | Kiểu dữ liệu | Bắt buộc | Ràng buộc validation | Mô tả |
|---|---|---|---|---|
| `email` | `string` | Có | Chuẩn email, tự động lowercase & trim | Email đã đăng ký |
| `password` | `string` | Có | Không được để trống | Mật khẩu đăng nhập |

*Ví dụ Request Body:*
```json
{
  "email": "student@example.com",
  "password": "Password123!"
}
```

#### Success Response
- **HTTP Status:** `200 OK`
- **Response Headers:**
```http
Set-Cookie: campusjob_refresh_token=...; Path=/api/v1/auth; HttpOnly; SameSite=Lax; Max-Age=2592000
```
- **Body (`LoginResponseDto`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "student@example.com",
    "fullName": "Nguyen Van A",
    "role": "STUDENT",
    "status": "ACTIVE",
    "emailVerified": true
  }
}
```

#### Expected Error Responses
- **400 Bad Request (`VALIDATION_ERROR`):** Email sai định dạng hoặc mật khẩu để trống.
- **401 Unauthorized (`INVALID_CREDENTIALS`):** Sai email hoặc sai mật khẩu (thông báo đồng nhất: *"Email hoặc mật khẩu không chính xác."* để phòng chống tấn công dò tìm tài khoản).
- **403 Forbidden (`ACCOUNT_PENDING_VERIFICATION`):** Tài khoản chưa kích hoạt qua email.
- **403 Forbidden (`ACCOUNT_SUSPENDED`):** Tài khoản đã bị đình chỉ hoạt động.
- **403 Forbidden (`ACCOUNT_LOCKED`):** Tài khoản đang bị khóa tạm thời.

---

### 2.3 Xoay vòng Refresh Token (Token Refresh)

- **Endpoint:** `POST /api/v1/auth/refresh`
- **Yêu cầu xác thực:** Public endpoint, nhưng yêu cầu có HttpOnly Cookie `campusjob_refresh_token` (hoặc header `x-refresh-token`).
- **Mô tả:** Cấp mới Access Token và xoay vòng Refresh Token. Áp dụng cơ chế Token Family để phát hiện và ngăn chặn hành vi sử dụng lại token đã thu hồi.

#### Request Header / Cookie
```http
Cookie: campusjob_refresh_token=<raw_refresh_token>
```
*(Tùy chọn: header `x-refresh-token: <raw_refresh_token>` phục vụ client phi trình duyệt).*

#### Request Body
*Không có (Body trống).*

#### Success Response
- **HTTP Status:** `200 OK`
- **Response Headers:**
```http
Set-Cookie: campusjob_refresh_token=<new_rotated_token>; Path=/api/v1/auth; HttpOnly; SameSite=Lax; Max-Age=2592000
```
- **Body (`RefreshResponseDto`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "student@example.com",
    "fullName": "Nguyen Van A",
    "role": "STUDENT",
    "status": "ACTIVE",
    "emailVerified": true
  }
}
```

#### Expected Error Responses
- **401 Unauthorized (`REFRESH_TOKEN_MISSING`):** Không tìm thấy cookie hoặc header refresh token.
- **401 Unauthorized (`REFRESH_TOKEN_INVALID`):** Token không tồn tại trong cơ sở dữ liệu.
- **401 Unauthorized (`REFRESH_TOKEN_EXPIRED`):** Phiên đăng nhập đã hết hạn.
- **401 Unauthorized (`REFRESH_TOKEN_REUSED`):** Phát hiện token cũ đã bị thu hồi được sử dụng lại (thu hồi tức thì toàn bộ token family).
- **403 Forbidden (`ACCOUNT_SUSPENDED`):** Tài khoản sở hữu phiên đã bị đình chỉ hoặc khóa.

---

### 2.4 Đăng xuất phiên hiện tại (Logout)

- **Endpoint:** `POST /api/v1/auth/logout`
- **Yêu cầu xác thực:** Public endpoint (chấp nhận refresh token từ cookie/header).
- **Mô tả:** Thu hồi phiên làm việc hiện tại trong cơ sở dữ liệu (`revokedAt = now`) và xóa bỏ refresh cookie trên trình duyệt. Tuân thủ nguyên lý Idempotent: luôn trả về thành công và xóa cookie ngay cả khi client không truyền token hoặc token không còn hợp lệ.

#### Request Header / Cookie
```http
Cookie: campusjob_refresh_token=<raw_refresh_token>
```

#### Request Body
*Không có (Body trống).*

#### Success Response
- **HTTP Status:** `200 OK`
- **Response Headers:**
```http
Set-Cookie: campusjob_refresh_token=; Path=/api/v1/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly
```
- **Body (`LogoutResponseDto`):**
```json
{
  "ok": true,
  "message": "Đăng xuất thành công."
}
```

---

### 2.5 Thu hồi tất cả phiên đăng xuất (Logout-All — Phụ thuộc mở rộng)

- **Endpoint:** `POST /api/v1/auth/logout-all`
- **Yêu cầu xác thực:** Bắt buộc Bearer Access Token (`@UseGuards(JwtAuthGuard)`).
- **Mô tả:** Thu hồi toàn bộ các phiên làm việc đang kích hoạt của người dùng hiện tại trên mọi thiết bị và xóa refresh cookie trên trình duyệt gọi lệnh.

#### Request Header
```http
Authorization: Bearer <accessToken>
```

#### Request Body
*Không có (Body trống).*

#### Success Response
- **HTTP Status:** `200 OK`
- **Response Headers:**
```http
Set-Cookie: campusjob_refresh_token=; Path=/api/v1/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly
```
- **Body (`LogoutResponseDto`):**
```json
{
  "ok": true,
  "message": "Đã thu hồi tất cả phiên đăng nhập."
}
```

#### Expected Error Responses
- **401 Unauthorized (`UNAUTHORIZED`):** Không có Access Token hoặc Access Token không hợp lệ / hết hạn.

---

### 2.6 Yêu cầu đặt lại mật khẩu (Forgot Password)

- **Endpoint:** `POST /api/v1/auth/forgot-password`
- **Yêu cầu xác thực:** Public (Không yêu cầu token)
- **Mô tả:** Tiếp nhận email và gửi hướng dẫn đặt lại mật khẩu kèm mã token xác thực (32 bytes ngẫu nhiên, lưu băm SHA-256 trong `PasswordResetToken`, hiệu lực 1 giờ).
- **Chống lộ diện tài khoản (Anti-enumeration):** Luôn trả về phản hồi trung tính (`200 OK`) bất kể email có tồn tại hay không trong hệ thống.
- **Giới hạn tần suất (Rate Limiting / Cooldown):** Áp dụng thời gian chờ tối thiểu 60 giây giữa 2 lần yêu cầu liên tiếp cho cùng một tài khoản. Nếu vi phạm, trả về `429 Too Many Requests`.

#### Request Header
```http
Content-Type: application/json
```

#### Request Body (`ForgotPasswordDto`)
| Trường | Kiểu dữ liệu | Bắt buộc | Ràng buộc validation | Mô tả |
|---|---|---|---|---|
| `email` | `string` | Có | Chuẩn email RFC 5322, tự động lowercase & trim | Email đã đăng ký |

*Ví dụ Request Body:*
```json
{
  "email": "student@example.com"
}
```

#### Success Response
- **HTTP Status:** `200 OK`
- **Body (`ForgotPasswordResponseDto`):**
```json
{
  "message": "If this email address is registered, instructions to reset your password have been sent."
}
```

#### Expected Error Responses
- **400 Bad Request (`VALIDATION_ERROR`):** Email không đúng định dạng.
- **429 Too Many Requests:** Gửi yêu cầu lặp lại trong thời gian chờ cooldown (< 60s).

---

### 2.7 Đặt lại mật khẩu (Reset Password)

- **Endpoint:** `POST /api/v1/auth/reset-password`
- **Yêu cầu xác thực:** Public (Xác thực qua one-time token trong body)
- **Mô tả:** Đặt lại mật khẩu mới cho tài khoản dựa trên raw reset token nhận qua email.
- **Tính toàn vẹn & Tiêu thụ 1 lần (One-time Use & Atomic Consumption):** Token reset chỉ có giá trị sử dụng đúng 1 lần duy nhất (`usedAt != null`). Quá trình kiểm tra token, cập nhật mật khẩu mới (băm Argon2id), đánh dấu tiêu thụ token và thu hồi toàn bộ phiên đăng nhập cũ (`AuthSession`) được thực thi trong một Database Transaction duy nhất (`$transaction`). Nếu có nhiều request đồng thời với cùng một token, chỉ duy nhất 1 request thành công.
- **Chính sách thu hồi phiên (Session Revocation Policy):** Khi đặt lại mật khẩu thành công, toàn bộ các phiên làm việc của người dùng trong bảng `AuthSession` lập tức bị thu hồi (`revokedAt = now()`), ngăn chặn việc sử dụng refresh token cũ để gia hạn phiên. (Lưu ý: Access Token JWT ngắn hạn 15m đã cấp trước đó sẽ tự động hết hạn tự nhiên sau 15 phút).

#### Request Header
```http
Content-Type: application/json
```

#### Request Body (`ResetPasswordDto`)
| Trường | Kiểu dữ liệu | Bắt buộc | Ràng buộc validation | Mô tả |
|---|---|---|---|---|
| `token` | `string` | Có | Không được để trống | Chuỗi raw token nhận từ liên kết email |
| `newPassword` | `string` | Có | Tối thiểu 8 ký tự, gồm ít nhất: 1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt | Mật khẩu mới đáp ứng chính sách bảo mật |

*Ví dụ Request Body:*
```json
{
  "token": "4f9a8b1c2d3e4f5a6b7c8d9e0f1a2b3c...",
  "newPassword": "BrandNewSecurePassword123!@#"
}
```

#### Success Response
- **HTTP Status:** `200 OK`
- **Body (`ResetPasswordResponseDto`):**
```json
{
  "message": "Password has been reset successfully. Please log in with your new password."
}
```

#### Expected Error Responses
- **400 Bad Request (`VALIDATION_ERROR`):** Dữ liệu không thỏa mãn DTO.
- **400 Bad Request (`WEAK_PASSWORD`):** Mật khẩu mới không thỏa mãn độ phức tạp chính sách bảo mật.
- **400 Bad Request:** Token không hợp lệ, token đã hết hạn, hoặc token đã được sử dụng trước đó.

---

### 2.8 Đổi mật khẩu khi đang đăng nhập (Change Password)

- **Endpoint:** `POST /api/v1/auth/change-password`
- **Yêu cầu xác thực:** Đã đăng nhập (`Bearer <JWT>` qua `JwtAuthGuard`)
- **Mô tả:** Người dùng đã xác thực tự thay đổi mật khẩu tài khoản của chính mình.
- **Quy tắc bảo mật & Tiêu chuẩn kỹ thuật:**
  - **Xác minh mật khẩu hiện tại:** Hệ thống sử dụng Argon2id để kiểm tra `currentPassword` với `user.passwordHash`. Nếu sai, trả về `400 Bad Request` với mã lỗi `INVALID_CREDENTIALS`.
  - **Chống đặt lại mật khẩu cũ:** `newPassword` bắt buộc phải khác `currentPassword`. Nếu trùng, trả về `400 Bad Request` với mã lỗi `VALIDATION_ERROR`.
  - **Độ phức tạp mật khẩu mới:** Tuân thủ chặt chẽ chính sách mật khẩu hệ thống (tối thiểu 8 ký tự, gồm ít nhất: 1 chữ hoa, 1 chữ thường, 1 chữ số, 1 ký tự đặc biệt). Nếu vi phạm, trả về `400 Bad Request` với mã lỗi `WEAK_PASSWORD`.
  - **Băm mật khẩu an toàn:** Mật khẩu mới được băm bằng thuật toán **Argon2id** trước khi lưu vào cơ sở dữ liệu.
  - **Chính sách thu hồi phiên (Session Revocation Policy):** Khi đổi mật khẩu thành công, toàn bộ các phiên làm việc của người dùng trong bảng `AuthSession` bị thu hồi (`revokedAt = now()`), đồng thời header `Set-Cookie` xóa cookie refresh token của client hiện tại. Bất kỳ refresh token cũ nào sử dụng sau đó đều bị từ chối với `401 Unauthorized`. (Lưu ý: Access Token JWT ngắn hạn 15m đã cấp trước đó sẽ hết hạn tự nhiên sau 15 phút).
  - **Ghi nhật ký kiểm toán (Audit Logging):** Tạo bản ghi trong bảng `AuditLog` với `action: "PASSWORD_CHANGED"`, `entityType: "User"`, `entityId: userId`, `actorId: userId`.

#### Request Header
```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

#### Request Body (`ChangePasswordDto`)
| Trường | Kiểu dữ liệu | Bắt buộc | Ràng buộc validation | Mô tả |
|---|---|---|---|---|
| `currentPassword` | `string` | Có | Không được để trống | Mật khẩu hiện tại để xác minh danh tính |
| `newPassword` | `string` | Có | Tối thiểu 8 ký tự, gồm ít nhất: 1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt; khác `currentPassword` | Mật khẩu mới |

*Ví dụ Request Body:*
```json
{
  "currentPassword": "CurrentPassword123!@#",
  "newPassword": "BrandNewSecurePassword456!@#"
}
```

#### Success Response
- **HTTP Status:** `200 OK`
- **Header:** `Set-Cookie: campusjob_refresh_token=; Path=/api/v1/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
- **Body (`ChangePasswordResponseDto`):**
```json
{
  "message": "Password has been changed successfully. Please log in with your new password."
}
```

#### Expected Error Responses
- **401 Unauthorized (`UNAUTHORIZED`):** Không truyền Bearer token hoặc token không hợp lệ / hết hạn.
- **400 Bad Request (`INVALID_CREDENTIALS`):** Mật khẩu hiện tại không chính xác (`"Current password is incorrect."`).
- **400 Bad Request (`VALIDATION_ERROR`):** Mật khẩu mới trùng với mật khẩu hiện tại (`"New password must be different from the current password."`).
- **400 Bad Request (`WEAK_PASSWORD`):** Mật khẩu mới không thỏa mãn độ phức tạp chính sách bảo mật.

---

## 3. Cơ chế Lưu trữ Refresh Token & Hướng dẫn Kiểm thử thủ công

### 3.1 Phân biệt Token Client nhận và Token lưu trong Cơ sở dữ liệu
- **Giá trị Client nắm giữ:** Chuỗi ngẫu nhiên nguyên bản (raw token, 40 bytes hex, ví dụ: `d4e5f6...`), được gửi tự động qua cookie `campusjob_refresh_token` hoặc header `x-refresh-token`.
- **Giá trị Cơ sở dữ liệu lưu trữ:** Cột `AuthSession.tokenHash` **không bao giờ** lưu chuỗi thô mà lưu bản băm SHA-256 (64 ký tự hex).
- **Quy trình xác thực:** Khi client gửi `rawRefreshToken`, máy chủ thực hiện băm `SHA-256(rawRefreshToken)` rồi so khớp với cột `tokenHash` trong bảng `AuthSession`.
- **Lưu ý cho Tester / Reviewer:** Khi kiểm tra trực tiếp PostgreSQL, không tìm kiếm chuỗi cookie thô trong cột `tokenHash`. Cần tra cứu theo `userId` hoặc so khớp với giá trị băm SHA-256.

### 3.2 Cấu hình Cổng Môi trường & Công cụ Kiểm thử
- **Swagger UI:** `http://localhost:8080/docs` (phục vụ từ cổng `API_PORT=8080` theo đúng cấu hình hệ thống, không sử dụng cổng 4000).
- **REST API Endpoint:** `http://localhost:8080/api/v1`.
- **Web Client:** `http://localhost:3000`.
- **Mailpit Web UI:** `http://localhost:8026`.
- **PostgreSQL Dev Port:** `localhost:5435` (database `campusjob`, user `campusjob`).

---

## 4. Kịch bản kiểm thử thủ công (Manual Testing Checklist)

> **LƯU Ý NGHIÊM NGẶT VỀ TRẠNG THÁI NGHIỆM THU:**  
> Toàn bộ các ca kiểm thử thủ công dưới đây được phân loại trạng thái là **`NOT RUN`** (Chưa thực hiện kiểm thử thủ công bởi con người trong phiên audit này). Kết quả kiểm thử tự động hồi quy đã được thực thi và chứng minh độc lập qua bộ test E2E (`apps/api/test/auth.e2e-spec.ts`).

| Mã kịch bản | Luồng nghiệp vụ | Các bước thực hiện thủ công | Kết quả mong đợi | Trạng thái thủ công | Tham chiếu Test tự động |
|---|---|---|---|---|---|
| `TC-MAN-01` | Đăng ký tài khoản Sinh viên / Nhà tuyển dụng | 1. Mở Swagger UI tại `http://localhost:8080/docs`.<br>2. Gọi `POST /api/v1/auth/register` với payload hợp lệ.<br>3. Mở Mailpit tại `http://localhost:8026` kiểm tra email kích hoạt.<br>4. Tra cứu bảng `User` trong PostgreSQL (`port 5435`). | Trả về HTTP 201 `RegisterResponseDto`.<br>Trạng thái tài khoản là `PENDING_VERIFICATION`.<br>Email xác minh được gửi thành công đến Mailpit. | **NOT RUN** | `auth.e2e-spec.ts` (Lines 72-123) |
| `TC-MAN-02` | Đăng nhập hệ thống | 1. Gọi `POST /api/v1/auth/login` với email đã kích hoạt và mật khẩu đúng.<br>2. Kiểm tra Response Body và Response Headers trong tab Network hoặc Postman. | HTTP 200 `LoginResponseDto` chứa `accessToken` JWT.<br>Header `Set-Cookie` chứa `campusjob_refresh_token` với cờ `HttpOnly`, `Path=/api/v1/auth`, `SameSite=Lax`. | **NOT RUN** | `auth.e2e-spec.ts` (Lines 487-510) |
| `TC-MAN-03` | Kiểm tra tính bí mật & lưu trữ Refresh Token trong DB | 1. Lấy giá trị cookie thô `campusjob_refresh_token` (chuỗi hex 40 bytes) sau khi đăng nhập.<br>2. Thực hiện băm SHA-256 chuỗi cookie thô trên máy trạm tester.<br>3. Chạy câu lệnh SQL `SELECT id, "userId", "tokenHash", "revokedAt" FROM "AuthSession" WHERE "userId" = '...';`. | Cột `tokenHash` trong DB lưu chuỗi SHA-256 hex (64 ký tự), **hoàn toàn không** chứa raw token thô.<br>Chuỗi SHA-256 tính từ raw cookie khớp chính xác với `tokenHash`. | **NOT RUN** | `auth.e2e-spec.ts` (Lines 416-450, 640-701) |
| `TC-MAN-04` | Xoay vòng Refresh Token (Token Rotation) | 1. Gọi `POST /api/v1/auth/refresh` kèm cookie `campusjob_refresh_token`.<br>2. Kiểm tra Response Body và `Set-Cookie`.<br>3. Kiểm tra bảng `AuthSession` trong PostgreSQL. | HTTP 200 trả về `accessToken` mới.<br>`Set-Cookie` cấp mới `campusjob_refresh_token`.<br>Session cũ có `revokedAt = now()`.<br>Session mới được tạo với cùng `tokenFamily`. | **NOT RUN** | `auth.e2e-spec.ts` (Lines 640-663) |
| `TC-MAN-05` | Ngăn chặn tấn công tái sử dụng Token (Reuse Detection) | 1. Gửi lại request `POST /api/v1/auth/refresh` bằng cookie cũ đã xoay vòng ở `TC-MAN-04`.<br>2. Kiểm tra mã lỗi và trạng thái DB. | HTTP 401 với mã lỗi `REFRESH_TOKEN_REUSED`.<br>Toàn bộ phiên thuộc cùng `tokenFamily` lập tức bị đánh dấu thu hồi (`revokedAt != null`). | **NOT RUN** | `auth.e2e-spec.ts` (Lines 665-701) |
| `TC-MAN-06` | Đăng xuất phiên hiện tại (Logout) | 1. Gọi `POST /api/v1/auth/logout` kèm cookie refresh token.<br>2. Kiểm tra Response Headers và DB. | HTTP 200 `{ ok: true, message: "..." }`.<br>Header `Set-Cookie` xóa cookie (`Expires=Thu, 01 Jan 1970`).<br>Phiên tương ứng trong DB có `revokedAt = now()`. | **NOT RUN** | `auth.e2e-spec.ts` (Lines 776-798) |
| `TC-MAN-07` | Thu hồi tất cả phiên (Logout-All) | 1. Đăng nhập tạo 2 phiên từ 2 client khác nhau.<br>2. Gọi `POST /api/v1/auth/logout-all` kèm Bearer Access Token.<br>3. Kiểm tra bảng `AuthSession`. | HTTP 200 `{ ok: true, message: "Đã thu hồi tất cả phiên đăng nhập." }`.<br>Tất cả bản ghi trong `AuthSession` của người dùng đều có `revokedAt != null`. | **NOT RUN** | `auth.e2e-spec.ts` (Lines 801-836) |
| `TC-MAN-08` | Yêu cầu đặt lại mật khẩu (Forgot Password) | 1. Gọi `POST /api/v1/auth/forgot-password` với email tài khoản đã có.<br>2. Kiểm tra phản hồi HTTP và mở Mailpit tại `http://localhost:8026`.<br>3. Thử lại với email không tồn tại. | HTTP 200 `{ message: "If this email address is registered..." }`.<br>Email reset mật khẩu gửi thành công tới Mailpit.<br>Email không tồn tại vẫn trả về cùng thông điệp 200 OK (không tiết lộ tài khoản). | **NOT RUN** | `auth.e2e-spec.ts` (Lines 368-405) |
| `TC-MAN-09` | Đặt lại mật khẩu thành công (Reset Password) | 1. Lấy `rawToken` từ email trong Mailpit.<br>2. Gọi `POST /api/v1/auth/reset-password` với `rawToken` và mật khẩu mới hợp lệ.<br>3. Kiểm tra bảng `User` và `PasswordResetToken` trong DB. | HTTP 200 `{ message: "Password has been reset successfully..." }`.<br>Bản ghi token có `usedAt != null`.<br>Mật khẩu người dùng được băm lại bằng Argon2id. | **NOT RUN** | `auth.e2e-spec.ts` (Lines 406-456) |
| `TC-MAN-10` | Đăng nhập với mật khẩu mới và từ chối mật khẩu cũ | 1. Đăng nhập với mật khẩu cũ trước khi reset.<br>2. Đăng nhập với mật khẩu mới vừa đổi. | Mật khẩu cũ trả về HTTP 401 `INVALID_CREDENTIALS`.<br>Mật khẩu mới trả về HTTP 200 kèm Access Token. | **NOT RUN** | `auth.e2e-spec.ts` |
| `TC-MAN-11` | Thu hồi toàn bộ Refresh Session cũ sau khi Reset Password | 1. Trước khi reset, tạo phiên đăng nhập để có cookie refresh token.<br>2. Thực hiện reset password thành công.<br>3. Dùng cookie refresh token cũ gọi `POST /api/v1/auth/refresh`. | Phiên cũ trong DB có `revokedAt != null`.<br>Gọi refresh bằng token cũ bị từ chối với HTTP 401. | **NOT RUN** | `auth.e2e-spec.ts` |
| `TC-MAN-12` | Đổi mật khẩu khi đang đăng nhập (Change Password) | 1. Đăng nhập lấy Bearer token.<br>2. Gọi `POST /api/v1/auth/change-password` với `currentPassword` đúng và `newPassword` hợp lệ.<br>3. Kiểm tra DB và gọi refresh bằng cookie cũ.<br>4. Thử đăng nhập lại bằng mật khẩu cũ và mới. | HTTP 200 `{ message: "Password has been changed successfully..." }`.<br>Header `Set-Cookie` xóa cookie refresh.<br>Toàn bộ phiên cũ trong bảng `AuthSession` bị thu hồi (`revokedAt = now()`).<br>Mật khẩu cũ bị từ chối 401 `INVALID_CREDENTIALS`.<br>Mật khẩu mới đăng nhập thành công. | **NOT RUN** | `auth.e2e-spec.ts` |

---

## 5. Kế hoạch Chuyển giao Kỹ thuật (Technical Transition)

- **Trạng thái Task S2-M01-01:** Hoàn thành chuẩn hóa Auth API Contract (C-01), mã hóa mã lỗi `AuthErrorCode`, đồng bộ types `@campusjob/contracts`.
- **Trạng thái Task S2-M01-02:** Hoàn thành ma trận phân quyền người dùng và kiểm soát truy cập dựa trên vai trò (RBAC).
- **Trạng thái Task S2-M01-04:** Hoàn thành luồng đặt lại mật khẩu và đổi mật khẩu an toàn (Password Reset & Change Password).
- **Trạng thái Task S2-M01-05:** Hoàn thành kiểm thử phân quyền liên phân hệ (Cross-Module Authorization).
- **Nhiệm vụ S2-M01-06 (Account Integration):** Đóng gói và chuẩn hóa hợp đồng ngữ cảnh xác thực `AuthContext` (8 trường chuẩn), kết nối trực tiếp với `JwtStrategy.validate`, xác lập `req.user.id` làm canonical identity, thực thi kiểm thử tích hợp liên phân hệ giữa `StudentsModule`, `NotificationsModule` và `M04Module` (Contract-Boundary), bảo đảm chống giả mạo danh tính qua body/params và thực thi nghiêm ngặt trạng thái tài khoản.

