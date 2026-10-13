# CAMPUSJOB — MA TRẬN TRẠNG THÁI TÀI KHOẢN (ACCOUNT STATE MATRIX)

Tài liệu này xác định ma trận kiểm soát trạng thái tài khoản người dùng (`UserStatus`), chính sách áp dụng tại backend (`apps/api`), hành vi thu hồi phiên (`AuthSession`) và hợp đồng mã lỗi chuẩn hóa cho nhiệm vụ **S2-M01-03**.

---

## 1. Nguồn Quy định và Cơ sở Pháp lý Kiến trúc (Authoritative Sources)

Các quy định về trạng thái người dùng trong hệ thống CampusJob được dẫn xuất trực tiếp từ các văn bản kỹ thuật nền tảng:
1. **`docs/ROLES_AND_STATES.md` (Mục II.1 - Máy trạng thái người dùng):**
   - Trạng thái khởi tạo sau đăng ký: `PENDING_VERIFICATION`.
   - Chuyển trạng thái khi xác minh email thành công: `PENDING_VERIFICATION` → `ACTIVE`.
   - Khóa tạm thời do vi phạm bởi Moderator/Admin: `ACTIVE` → `SUSPENDED` (có thể mở khóa lại thành `ACTIVE`).
   - Khóa vĩnh viễn/nghiêm trọng bởi Admin: `ACTIVE` / `SUSPENDED` → `LOCKED` (trạng thái kết thúc).
2. **`docs/SCOPE_AND_REQUIREMENTS.md` (Mục I.1 - Core Scope FR-01, FR-02, FR-03, FR-19):**
   - Yêu cầu kiểm soát trạng thái đăng nhập, xác minh email, refresh token, phân quyền quản trị và nhật ký kiểm toán.
3. **`docs/api/AUTH_ERROR_MATRIX.md` (Hợp đồng mã lỗi C-01):**
   - `ACCOUNT_PENDING_VERIFICATION` (403 Forbidden): Yêu cầu xác minh email.
   - `ACCOUNT_SUSPENDED` (403 Forbidden): Tài khoản bị đình chỉ hoạt động.
   - `ACCOUNT_LOCKED` (403 Forbidden): Tài khoản bị khóa quản trị.

---

## 2. Ma trận Trạng thái Tài khoản Chi tiết (Account State Matrix)

### 2.1 Bảng ma trận Hành vi và Phản hồi

| Trạng thái (`UserStatus`) | Thao tác (Action) | Cho phép? | HTTP Status | Mã lỗi (`code`) | Thông điệp phản hồi (`message`) | Hiệu lực Token / Phiên | Chuyển trạng thái? | Nguồn quy định | Bằng chứng Kiểm thử Tự động |
|---|---|---|---|---|---|---|---|---|---|
| **Bất kỳ** | Đăng ký tài khoản (`POST /auth/register`) | Cho phép | `201 Created` | N/A | Tạo tài khoản thành công | Cấp email token (chưa cấp session đăng nhập) | Khởi tạo `PENDING_VERIFICATION` | `ROLES_AND_STATES.md` | `auth.e2e-spec.ts` |
| **`PENDING_VERIFICATION`** | Đăng nhập (`POST /auth/login`) | **Từ chối** | `403 Forbidden` | `ACCOUNT_PENDING_VERIFICATION` | `"Tài khoản chưa được xác minh email..."` | Không cấp session / token | Không | `AUTH_ERROR_MATRIX.md` | `account-state.e2e-spec.ts`, `auth.e2e-spec.ts` |
| **`PENDING_VERIFICATION`** | Refresh token (`POST /auth/refresh`) | **Từ chối** | `403 Forbidden` | `ACCOUNT_PENDING_VERIFICATION` | `"Tài khoản chưa được xác minh email..."` | Không quay vòng session, giữ nguyên phiên cũ | Không | Triển khai mới (S2-M01-03) | `account-state.e2e-spec.ts`, `refresh.use-case.spec.ts` |
| **`PENDING_VERIFICATION`** | Endpoint bảo vệ JWT (`GET /auth/me`) | **Từ chối** | `403 Forbidden` | `ACCOUNT_PENDING_VERIFICATION` | `"Tài khoản chưa được xác minh email..."` | Access token bị từ chối ở Guard/Strategy | Không | Triển khai mới (S2-M01-03) | `account-state.e2e-spec.ts`, `jwt.strategy.spec.ts` |
| **`PENDING_VERIFICATION`** | Gửi lại email kích hoạt (`POST /auth/resend-verification`) | Cho phép | `200 OK` | N/A | Gửi email xác minh mới | Hủy token cũ, tạo token xác minh mới | Không | `SCOPE_AND_REQUIREMENTS.md` | `account-state.e2e-spec.ts`, `resend-verification.use-case.spec.ts` |
| **`PENDING_VERIFICATION`** | Kích hoạt email (`POST /auth/verify-email`) | Cho phép | `200 OK` | N/A | Kích hoạt thành công | Tiêu thụ token, cập nhật `emailVerifiedAt` | Chuyển sang `ACTIVE` | `ROLES_AND_STATES.md` | `account-state.e2e-spec.ts`, `verify-email.use-case.spec.ts` |
| **`ACTIVE`** | Đăng nhập (`POST /auth/login`) | Cho phép | `200 OK` | N/A | Đăng nhập thành công | Cấp Access token (JWT 15m) + Refresh cookie (30d) | Không | `SCOPE_AND_REQUIREMENTS.md` | `account-state.e2e-spec.ts`, `auth.e2e-spec.ts` |
| **`ACTIVE`** | Refresh token (`POST /auth/refresh`) | Cho phép | `200 OK` | N/A | Làm mới phiên thành công | Quay vòng refresh token (RTR) + cấp access token mới | Không | `SCOPE_AND_REQUIREMENTS.md` | `account-state.e2e-spec.ts`, `auth.e2e-spec.ts` |
| **`ACTIVE`** | Endpoint bảo vệ JWT (`GET /auth/me`) | Cho phép | `200 OK` | N/A | Trả về thông tin người dùng | Access token hợp lệ | Không | `SCOPE_AND_REQUIREMENTS.md` | `account-state.e2e-spec.ts`, `auth.e2e-spec.ts` |
| **`ACTIVE`** | Gửi lại email kích hoạt (`POST /auth/resend-verification`) | **Từ chối** | `400 Bad Request` | `VALIDATION_ERROR` | `"This account has already been verified."` | Không gửi mail | Không | `resend-verification.use-case.ts` | `account-state.e2e-spec.ts`, `resend-verification.use-case.spec.ts` |
| **`SUSPENDED`** | Đăng nhập (`POST /auth/login`) | **Từ chối** | `403 Forbidden` | `ACCOUNT_SUSPENDED` | `"Tài khoản đã bị đình chỉ hoạt động."` | Không cấp session / token | Không | `AUTH_ERROR_MATRIX.md` | `account-state.e2e-spec.ts`, `auth.e2e-spec.ts` |
| **`SUSPENDED`** | Refresh token (`POST /auth/refresh`) | **Từ chối** | `403 Forbidden` | `ACCOUNT_SUSPENDED` | `"Tài khoản đã bị đình chỉ hoạt động."` | Chặn trước khi quay vòng; session không bị thay đổi | Không | Triển khai mới (S2-M01-03) | `account-state.e2e-spec.ts`, `refresh.use-case.spec.ts` |
| **`SUSPENDED`** | Endpoint bảo vệ JWT (`GET /auth/me`) | **Từ chối** | `403 Forbidden` | `ACCOUNT_SUSPENDED` | `"Tài khoản đã bị đình chỉ hoạt động."` | Access token bị chặn ngay tại `JwtStrategy` | Không | `jwt.strategy.ts` | `account-state.e2e-spec.ts`, `jwt.strategy.spec.ts`, `rbac.e2e-spec.ts` |
| **`SUSPENDED`** | Gửi lại email kích hoạt (`POST /auth/resend-verification`) | **Từ chối** | `403 Forbidden` | `ACCOUNT_SUSPENDED` | `"Tài khoản đã bị đình chỉ hoạt động."` | Không gửi email | Không | Triển khai mới (S2-M01-03) | `account-state.e2e-spec.ts`, `resend-verification.use-case.spec.ts` |
| **`LOCKED`** | Đăng nhập (`POST /auth/login`) | **Từ chối** | `403 Forbidden` | `ACCOUNT_LOCKED` | `"Tài khoản đang bị khóa tạm thời. Vui lòng liên hệ quản trị viên."` | Không cấp session / token | Không | `AUTH_ERROR_MATRIX.md` | `account-state.e2e-spec.ts`, `auth.e2e-spec.ts` |
| **`LOCKED`** | Refresh token (`POST /auth/refresh`) | **Từ chối** | `403 Forbidden` | `ACCOUNT_LOCKED` | `"Tài khoản đang bị khóa tạm thời. Vui lòng liên hệ quản trị viên."` | Chặn trước khi quay vòng; session không bị thay đổi | Không | Triển khai mới (S2-M01-03) | `account-state.e2e-spec.ts`, `refresh.use-case.spec.ts` |
| **`LOCKED`** | Endpoint bảo vệ JWT (`GET /auth/me`) | **Từ chối** | `403 Forbidden` | `ACCOUNT_LOCKED` | `"Tài khoản đang bị khóa tạm thời. Vui lòng liên hệ quản trị viên."` | Access token bị chặn ngay tại `JwtStrategy` | Không | Triển khai mới (S2-M01-03) | `account-state.e2e-spec.ts`, `jwt.strategy.spec.ts` |
| **`LOCKED`** | Gửi lại email kích hoạt (`POST /auth/resend-verification`) | **Từ chối** | `403 Forbidden` | `ACCOUNT_LOCKED` | `"Tài khoản đang bị khóa tạm thời. Vui lòng liên hệ quản trị viên."` | Không gửi email | Không | Triển khai mới (S2-M01-03) | `account-state.e2e-spec.ts`, `resend-verification.use-case.spec.ts` |

---

## 3. Phân định Trạng thái Hiện thực hóa (Implementation Status Breakdown)

### 3.1 Quy định đã xác nhận (Confirmed Requirements)
- Khởi tạo người dùng ở trạng thái `PENDING_VERIFICATION`.
- Chỉ người dùng `ACTIVE` mới được phép đăng nhập và cấp session.
- Tài khoản `SUSPENDED` và `LOCKED` bị chặn truy cập đăng nhập với mã lỗi tương ứng `ACCOUNT_SUSPENDED` và `ACCOUNT_LOCKED`.
- Quản trị viên/Moderator thực hiện chuyển đổi trạng thái thông qua phân hệ quản trị.

### 3.2 Hành vi hiện hữu trước S2-M01-03 (Existing Behavior)
- `LoginUseCase` đã có đầy đủ kiểm tra trạng thái cho cả 3 trạng thái không hợp lệ (`PENDING_VERIFICATION`, `SUSPENDED`, `LOCKED`).
- `VerifyEmailUseCase` thực hiện transaction chuyển trạng thái `PENDING_VERIFICATION` sang `ACTIVE`.
- `JwtStrategy` đã kiểm tra `SUSPENDED` và `LOCKED`.

### 3.3 Hành vi mới được triển khai trong S2-M01-03 (Newly Implemented Behavior)
1. **Kiểm tra trạng thái trước khi quay vòng session trong `RefreshUseCase`:**
   - Trước đây: `rotateSession` được gọi trước khi kiểm tra trạng thái người dùng, dẫn đến session bị xoay token và ghi vào DB trước khi ném lỗi 403.
   - Hiện tại: Kiểm tra người dùng và trạng thái (`SUSPENDED`, `LOCKED`, `PENDING_VERIFICATION`) diễn ra **TRƯỚC** khi gọi `rotateSession`. Nếu tài khoản không hợp lệ, ném ngoại lệ ngay lập tức và bảo toàn session trong DB.
2. **Bổ sung kiểm tra `PENDING_VERIFICATION` trong `JwtStrategy`:**
   - Đảm bảo nếu một access token tồn tại (hoặc được cấp thử nghiệm) cho tài khoản chưa kích hoạt, mọi request tới endpoint bảo vệ đều bị chặn với mã `ACCOUNT_PENDING_VERIFICATION`.
   - Đồng bộ hóa thông điệp lỗi của `ACCOUNT_LOCKED` trên `JwtStrategy` khớp với `LoginUseCase`.
3. **Bổ sung kiểm tra trạng thái tài khoản trong `ResendVerificationUseCase`:**
   - Chặn người dùng `SUSPENDED` và `LOCKED` gửi yêu cầu cấp lại mã kích hoạt, trả về mã lỗi 403 tương ứng.

### 3.4 Vấn đề chính sách chưa giải quyết / Cần quyết định từ PM (Unresolved Policy Decisions)
- **Thu hồi chủ động tất cả Refresh Session khi tài khoản bị khóa (`SUSPENDED` / `LOCKED`):** Hiện tại, khi Admin đổi trạng thái người dùng trong DB, `JwtStrategy` và `RefreshUseCase` sẽ chặn ngay lập tức mọi request kế tiếp. Tuy nhiên, nếu muốn xóa cứng/thu hồi ngay lập tức toàn bộ record trong bảng `AuthSession` ngay thời điểm Admin thao tác, cần triển khai hook/event tại module Quản trị người dùng (Admin Users) (mã Use Case cho phân hệ Quản trị người dùng & Audit Log hiện đang chờ xác định chính thức / pending identification; lưu ý UC21 theo danh mục chuẩn là Quản lý chi nhánh doanh nghiệp). Quyết định này thuộc phạm vi module Quản trị người dùng & Audit Log.

---

## 4. Danh mục Kiểm thử Thủ công (Manual Testing Checklist)

Dưới đây là danh sách kịch bản kiểm thử thủ công dành cho kiểm thử viên/QA. Toàn bộ kịch bản được gắn trạng thái **`NOT RUN`** để chờ người thực hiện kiểm chứng trên môi trường thực tế.

| Test ID | Mục đích kiểm thử | Trạng thái tài khoản & Tiền điều kiện | Công cụ thực hiện | Endpoint, Method & Payload | Các bước thực hiện chi tiết | Kết quả mong đợi (HTTP & Code) | Hành vi Token / Session mong đợi | Trạng thái thực tế |
|---|---|---|---|---|---|---|---|---|
| **TC-STATE-01** | Kiểm tra đăng nhập tài khoản chưa xác minh | Tài khoản `PENDING_VERIFICATION` (mới đăng ký) | Swagger (`http://localhost:8080/docs`) hoặc Postman | `POST /api/v1/auth/login`<br>Body: `{ "email": "...", "password": "..." }` | 1. Đăng ký tài khoản mới.<br>2. Gọi API login ngay lập tức. | `403 Forbidden`<br>`code: ACCOUNT_PENDING_VERIFICATION` | Không cấp Cookie `refreshToken`, không trả về `accessToken`. | **NOT RUN** |
| **TC-STATE-02** | Kiểm tra đăng nhập tài khoản bị đình chỉ | Tài khoản `SUSPENDED` (được cập nhật trong DB) | Postman & PostgreSQL DBeaver/psql | `POST /api/v1/auth/login`<br>Body: `{ "email": "...", "password": "..." }` | 1. Cập nhật `status = 'SUSPENDED'` trong bảng `users`.<br>2. Gửi request login với đúng mật khẩu. | `403 Forbidden`<br>`code: ACCOUNT_SUSPENDED` | Không cấp Cookie `refreshToken`, không trả về `accessToken`. | **NOT RUN** |
| **TC-STATE-03** | Kiểm tra đăng nhập tài khoản bị khóa | Tài khoản `LOCKED` (được cập nhật trong DB) | Postman & PostgreSQL DBeaver/psql | `POST /api/v1/auth/login`<br>Body: `{ "email": "...", "password": "..." }` | 1. Cập nhật `status = 'LOCKED'` trong bảng `users`.<br>2. Gửi request login với đúng mật khẩu. | `403 Forbidden`<br>`code: ACCOUNT_LOCKED` | Không cấp Cookie `refreshToken`, không trả về `accessToken`. | **NOT RUN** |
| **TC-STATE-04** | Kiểm tra làm mới token khi tài khoản bị đình chỉ giữa phiên | Tài khoản `ACTIVE` đã đăng nhập có Cookie `refreshToken` | Postman (Cookie Jar) & PostgreSQL | `POST /api/v1/auth/refresh`<br>Header: `Cookie: refreshToken=...` | 1. Đăng nhập khi tài khoản đang `ACTIVE`.<br>2. Cập nhật `status = 'SUSPENDED'` trong DB.<br>3. Gửi request refresh token. | `403 Forbidden`<br>`code: ACCOUNT_SUSPENDED` | Phiên không được quay vòng, không cấp token mới. | **NOT RUN** |
| **TC-STATE-05** | Kiểm tra làm mới token khi tài khoản bị khóa giữa phiên | Tài khoản `ACTIVE` đã đăng nhập có Cookie `refreshToken` | Postman (Cookie Jar) & PostgreSQL | `POST /api/v1/auth/refresh`<br>Header: `Cookie: refreshToken=...` | 1. Đăng nhập khi tài khoản đang `ACTIVE`.<br>2. Cập nhật `status = 'LOCKED'` trong DB.<br>3. Gửi request refresh token. | `403 Forbidden`<br>`code: ACCOUNT_LOCKED` | Phiên không được quay vòng, không cấp token mới. | **NOT RUN** |
| **TC-STATE-06** | Kiểm tra gọi endpoint bảo vệ với Access Token khi tài khoản bị đình chỉ | Tài khoản `ACTIVE` đã đăng nhập có Bearer `accessToken` còn hạn | Postman / Curl | `GET /api/v1/auth/me`<br>Header: `Authorization: Bearer <token>` | 1. Đăng nhập và lấy Access Token.<br>2. Cập nhật `status = 'SUSPENDED'` trong DB.<br>3. Gửi request GET `/auth/me`. | `403 Forbidden`<br>`code: ACCOUNT_SUSPENDED` | Access Token bị vô hiệu hóa logic ngay lập tức. | **NOT RUN** |
| **TC-STATE-07** | Kiểm tra gọi endpoint bảo vệ với Access Token khi tài khoản bị khóa | Tài khoản `ACTIVE` đã đăng nhập có Bearer `accessToken` còn hạn | Postman / Curl | `GET /api/v1/auth/me`<br>Header: `Authorization: Bearer <token>` | 1. Đăng nhập và lấy Access Token.<br>2. Cập nhật `status = 'LOCKED'` trong DB.<br>3. Gửi request GET `/auth/me`. | `403 Forbidden`<br>`code: ACCOUNT_LOCKED` | Access Token bị vô hiệu hóa logic ngay lập tức. | **NOT RUN** |
| **TC-STATE-08** | Kiểm tra gửi lại email kích hoạt cho tài khoản bị đình chỉ | Tài khoản `SUSPENDED` | Postman | `POST /api/v1/auth/resend-verification`<br>Body: `{ "email": "..." }` | 1. Đảm bảo tài khoản mang trạng thái `SUSPENDED`.<br>2. Gửi request resend. | `403 Forbidden`<br>`code: ACCOUNT_SUSPENDED` | Không tạo token mới, không gửi email. | **NOT RUN** |
| **TC-STATE-09** | Kích hoạt tài khoản thành công qua email | Tài khoản `PENDING_VERIFICATION` có token trong Mailpit | Browser / Postman / Mailpit (`http://localhost:8026`) | `POST /api/v1/auth/verify-email`<br>Body: `{ "token": "<rawToken>" }` | 1. Đăng ký tài khoản.<br>2. Lấy token xác minh từ Mailpit UI.<br>3. Gọi API verify-email. | `200 OK`<br>`message: "Email verified successfully..."` | Chuyển trạng thái sang `ACTIVE`, cho phép đăng nhập sau đó. | **NOT RUN** |
