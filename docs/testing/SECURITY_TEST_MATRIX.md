# CAMPUSJOB — MA TRẬN KIỂM THỬ BẢO MẬT LIÊN PHÂN HỆ (CROSS-MODULE SECURITY TEST MATRIX)

Tài liệu này xác định ma trận kiểm thử bảo mật liên phân hệ (Cross-module Security Test Matrix) chính thức cho nhiệm vụ **S2-M01-05**, đóng vai trò nguồn chân lý (Single Source of Truth) giữa Backend (`apps/api`), Gói hợp đồng dùng chung (`packages/contracts`), và hệ thống kiểm thử tự động E2E.

- **Mã nhiệm vụ:** S2-M01-05 — Cross-module Authorization
- **Bổ sung:** S3-M01-03 — Protect `GET /api/v1/users/:id` (ca T24–T29 bên dưới)
- **Phân hệ bao phủ:** M01 (Account & RBAC), M02 (Student Profile & CV), M03 (Employer & Job Ownership), M04 (Application & Interview Flow)
- **Hợp đồng quy chiếu:**
  - **C-01 (Auth Contract):** Định danh người dùng, JWT token payload, trạng thái tài khoản (`UserStatus`), chuẩn lỗi `ApiErrorResponse`.
  - **C-02 (RBAC Matrix):** Cơ chế phân quyền dựa trên vai trò qua `@Roles(...)` và `RolesGuard`, mã lỗi `FORBIDDEN`.
  - **C-03 (CV Snapshot Contract):** Nộp hồ sơ bằng bản chụp CV bất biến; kiểm tra CV thuộc quyền sở hữu của sinh viên đang nộp đơn.
  - **C-04 (Privacy & Safe View Contract):** Nhà tuyển dụng không có quyền gọi trực tiếp các endpoint CV của sinh viên; chỉ xem CV qua bản chụp gắn với đơn ứng tuyển.
  - **C-05 (Ownership Verification & Anti-IDOR):** Trích xuất định danh `userId` an toàn từ AuthContext JWT (`req.user.id`). Thao tác trái phép trên tài nguyên của người khác trả về `404 Not Found` (`CV_NOT_FOUND` / `NOT_FOUND`) để ngăn chặn việc dò quét định danh (ID harvesting).
  - **M04 Application Contract:** Ứng viên chỉ xem và thao tác trên đơn ứng tuyển của mình; Nhà tuyển dụng chỉ xem và xử lý ứng viên của tin tuyển dụng do doanh nghiệp mình trực tiếp quản lý.

---

## 4. Bổ sung kiểm thử bảo mật cho `GET /api/v1/users/:id` (S3-M01-03)

Route dùng `JwtAuthGuard` và principal `AuthContext` đã được xác minh. Người dùng được xem tài khoản của chính mình; chỉ `ADMIN` được xem tài khoản khác. Từ chối cross-account cho các vai trò khác trả `403 FORBIDDEN` trước khi truy vấn repository. Do đó, 403 áp dụng cho mọi ID đích và không phân biệt ID có tồn tại hay không. Tài khoản đích không tồn tại trả 404 sau khi quyền truy cập đã được cho phép. Response chỉ gồm `id`, `email`, `fullName`, `role`, `status`, `emailVerified`.

| Mã Case | Tuyến đường | Tác nhân / tình huống | Đơn vị thực thi | Kết quả mong đợi |
| :---: | :--- | :--- | :--- | :--- |
| **T24** | `GET /api/v1/users/:id` | Khách vãng lai, không có JWT | `JwtAuthGuard` | 401 `UNAUTHORIZED` |
| **T25** | `GET /api/v1/users/:id` | JWT sai chữ ký/định dạng | `JwtAuthGuard` | 401 `UNAUTHORIZED` |
| **T26** | `GET /api/v1/users/:id` | Mọi vai trò xem tài khoản có ID trùng với `AuthContext.id` | `GetUserByIdUseCase` | 200; đúng allowlist response |
| **T27** | `GET /api/v1/users/:id` | `STUDENT`, `EMPLOYER`, hoặc `MODERATOR` xem ID khác; cố giả mạo role qua header/query | `GetUserByIdUseCase` | 403 `FORBIDDEN`; repository không được gọi |
| **T28** | `GET /api/v1/users/:id` | `ADMIN` xem ID tài khoản khác | `GetUserByIdUseCase` | 200; đúng allowlist response |
| **T29** | `GET /api/v1/users/:id` | `ADMIN` xem ID hợp lệ nhưng không tồn tại | `GetUserByIdUseCase` | 404 Not Found |

---

## 1. Nguyên tắc Phân quyền và Chống IDOR (Core Security Principles)

1. **Kiểm soát đa lớp (Defense in Depth):**
   - **Lớp 1 — Xác thực (`JwtAuthGuard` & `JwtStrategy`):** Kiểm tra chữ ký token, thời hạn token, và trạng thái tài khoản trong DB (`ACTIVE`). Chặn đứng tài khoản `SUSPENDED` (`ACCOUNT_SUSPENDED`) và `LOCKED` (`ACCOUNT_LOCKED`) với mã lỗi `403 Forbidden`.
   - **Lớp 2 — Vai trò (`RolesGuard`):** Kiểm tra `req.user.role` với metadata `@Roles(...)`. Nếu sai vai trò, chặn ngay tại tầng Guard với `403 Forbidden` (`FORBIDDEN`).
   - **Lớp 3 — Quyền sở hữu tài nguyên (Resource Ownership / Use Case):** Định danh người dùng luôn được lấy từ `@CurrentUser('id')`, tuyệt đối không tin cậy `userId` hay `studentId` truyền từ client qua body hoặc URL params.
2. **Chiến lược Chống dò quét định danh (Anti-IDOR Strategy):**
   - Khi một sinh viên cố tình truy cập, chỉnh sửa hoặc xóa CV/Đơn ứng tuyển thuộc về sinh viên khác, hệ thống **bắt buộc trả về `404 Not Found`** thay vì `403 Forbidden`.
   - *Lý do bảo mật:* Trả về `403 Forbidden` sẽ gián tiếp thông báo cho kẻ tấn công biết rằng tài nguyên với ID đó thực sự tồn tại trong hệ thống (ID harvesting). Phản hồi `404 Not Found` làm cho việc dò quét tài nguyên của người khác trở nên vô hiệu.

---

## 2. Phân định Ranh giới Kiến trúc Kiểm thử (Test Architecture Boundaries)

Bộ kiểm thử [apps/api/test/cross-module-auth.e2e-spec.ts](file:///c:/Users/Khang/OneDrive/Desktop/SE100/se100-part-time-job-and-internship-management-system-for-students/apps/api/test/cross-module-auth.e2e-spec.ts) phân định rạch ròi 2 tầng kiến trúc:

### Tầng 1: Kiểm thử Production E2E thực tế (T01 – T12)
- **Tập tin ứng dụng:** `AppModule` chính thức (`apps/api/src/app.module.ts`).
- **Phân hệ kiểm chứng:** Hồ sơ sinh viên (`StudentsController`) và Quản lý CV (`CvsController`).
- **Cơ sở dữ liệu:** PostgreSQL thực tế (Port 5435), seed và cleanup bằng Prisma thực tế.
- **Giá trị chứng minh:** Khẳng định các endpoint sản xuất đang chạy trong `AppModule` chặn đứng truy cập không xác thực (401), sai vai trò (403), tài khoản vi phạm (403), và vi phạm sở hữu CV theo nguyên tắc chống IDOR (404).

### Tầng 2: Kiểm thử Hợp đồng Phân quyền M04 (T13 – T23)
- **Lý do kiến trúc:** Phân hệ M04 (`M04Module`) cố ý chưa được đăng ký vào `AppModule` vì cần hai adapter thực tế từ M02 (CV Snapshot) và M03 (Job Ownership) mà hai module này chưa cung cấp adapter chính thức trong `apps/api/src`.
- **Cấu hình kiểm thử:** Khởi tạo `Test.createTestingModule` độc lập liên kết `M04Controller`, `M04Workflow`, `M04ExceptionFilter`, `RolesGuard`, `JwtAuthGuard` với:
  - `PrismaM04Repository` thực tế kết nối PostgreSQL để lưu trữ và truy vấn dữ liệu đơn ứng tuyển thật.
  - Contract-test adapter cho `CvSnapshotSource` (kiểm chứng việc Workflow từ chối khi CV không thuộc sở hữu của sinh viên nộp đơn).
  - Contract-test adapter cho `JobAccessSource` (kiểm chứng việc Workflow gọi `assertManagedBy` và từ chối khi Nhà tuyển dụng không quản lý tin tuyển dụng).
- **Giá trị chứng minh:** Kiểm chứng chính xác logic phân quyền và xử lý ngoại lệ HTTP của M04. Không chứng minh rằng M02 và M03 đã có code sản xuất hoàn thiện cho hai adapter trên.

---

## 3. Ma trận Kiểm thử 23 Test Cases Cốt lõi (23-Case Test Matrix)

$$\text{Tổng số ca kiểm thử} = 12\ (\text{Student/CV}) + 6\ (\text{Student Application}) + 5\ (\text{Employer Job/Candidate}) = \mathbf{23\ cases}$$

| Mã Case | Tuyến đường (Endpoint) | Phương thức | Tác nhân thực thi | Bối cảnh phân quyền & Quyền sở hữu | Tầng kiểm thử | Đơn vị thực thi quyền hạn | Vai trò Cổng / Adapter | HTTP Status | Error Code (`code`) |
| :---: | :--- | :---: | :--- | :--- | :---: | :--- | :--- | :---: | :--- |
| **T01** | `/api/v1/students/cvs` | `GET` | Khách vãng lai | Chưa đăng nhập (Không có Authorization header) | Production E2E | `JwtAuthGuard` | N/A (Route sản xuất) | `401` | `UNAUTHORIZED` |
| **T02** | `/api/v1/students/cvs` | `GET` | Employer | `UserRole.EMPLOYER` | Production E2E | `RolesGuard(STUDENT)` | N/A (Contract C-04: Cấm Employer xem trực tiếp CV) | `403` | `FORBIDDEN` |
| **T03** | `/api/v1/students/cvs` | `GET` | Moderator | `UserRole.MODERATOR` | Production E2E | `RolesGuard(STUDENT)` | N/A (Chặn vai trò không được phép) | `403` | `FORBIDDEN` |
| **T04** | `/api/v1/students/cvs` | `GET` | Admin | `UserRole.ADMIN` | Production E2E | `RolesGuard(STUDENT)` | N/A (Chặn vai trò không được phép) | `403` | `FORBIDDEN` |
| **T05** | `/api/v1/students/cvs` | `GET` | Student A | `STUDENT` (Chính chủ) | Production E2E | `CvsController.listCvs` | N/A (Trả về danh sách CV của Student A) | `200` | N/A |
| **T06** | `/api/v1/students/cvs/:id` | `GET` | Student B | `STUDENT` (`cvId` của Student A) | Production E2E | `GetCvDetailUseCase` | N/A (Contract C-05: Chống IDOR, không lộ sự tồn tại) | `404` | `CV_NOT_FOUND` |
| **T07** | `/api/v1/students/cvs/:id` | `PATCH` | Student B | `STUDENT` (`cvId` của Student A) | Production E2E | `UpdateCvUseCase` | N/A (Contract C-05: Chống IDOR, cấm sửa CV người khác) | `404` | `CV_NOT_FOUND` |
| **T08** | `/api/v1/students/cvs/:id/default` | `PATCH` | Student B | `STUDENT` (`cvId` của Student A) | Production E2E | `SetDefaultCvUseCase` | N/A (Contract C-05: Chống IDOR, cấm đổi default) | `404` | `CV_NOT_FOUND` |
| **T09** | `/api/v1/students/cvs/:id` | `DELETE` | Student B | `STUDENT` (`cvId` của Student A) | Production E2E | `DeleteCvUseCase` | N/A (Contract C-05: Chống IDOR, cấm xóa CV người khác) | `404` | `CV_NOT_FOUND` |
| **T10** | `/api/v1/students/profile` | `GET` | Employer | `UserRole.EMPLOYER` | Production E2E | `RolesGuard(STUDENT)` | N/A (Chặn Employer truy cập hồ sơ sinh viên) | `403` | `FORBIDDEN` |
| **T11** | `/api/v1/students/profile` | `PATCH` | Student A | `UserStatus.SUSPENDED` | Production E2E | `JwtStrategy` | N/A (Account State Matrix: Từ chối tài khoản đình chỉ) | `403` | `ACCOUNT_SUSPENDED` |
| **T12** | `/api/v1/students/profile` | `PATCH` | Student A | `UserStatus.LOCKED` | Production E2E | `JwtStrategy` | N/A (Account State Matrix: Từ chối tài khoản bị khóa) | `403` | `ACCOUNT_LOCKED` |
| **T13** | `/api/v1/jobs/:jobId/apply` | `POST` | Employer | `UserRole.EMPLOYER` | M04 Contract | `RolesGuard(STUDENT)` | Chặn ở tầng Guard của Controller | `403` | `FORBIDDEN` |
| **T14** | `/api/v1/jobs/:jobId/apply` | `POST` | Student A | `STUDENT` (Dùng `cvId` của Student B) | M04 Contract | `M04Workflow.submit` | `CvSnapshotSource` trả snapshot sai owner; Workflow phát hiện vi phạm và ném `FORBIDDEN` | `403` | `FORBIDDEN` |
| **T15** | `/api/v1/jobs/:jobId/apply` | `POST` | Student A | `STUDENT` (Dùng `cvId` chính chủ) | M04 Contract | `PrismaM04Repository` | Các adapter xác thực hợp lệ; lưu bản ghi thật vào PostgreSQL | `201` | N/A |
| **T16** | `/api/v1/applications/me/:id` | `GET` | Employer | `UserRole.EMPLOYER` | M04 Contract | `RolesGuard(STUDENT)` | Chặn ở tầng Guard của Controller | `403` | `FORBIDDEN` |
| **T17** | `/api/v1/applications/me/:id` | `GET` | Student B | `STUDENT` (Đơn của Student A) | M04 Contract | `M04Workflow.getMine` | `PrismaM04Repository` đọc DB thật; Workflow kiểm tra `studentId !== studentId` và ném `NOT_FOUND` | `404` | `NOT_FOUND` |
| **T18** | `/api/v1/applications/me/:id/withdraw` | `PATCH` | Student B | `STUDENT` (Đơn của Student A) | M04 Contract | `M04Workflow.withdraw` | `PrismaM04Repository` đọc DB thật; Workflow chặn rút đơn người khác | `404` | `NOT_FOUND` |
| **T19** | `/api/v1/employer/jobs/:jobId/applications` | `GET` | Student | `UserRole.STUDENT` | M04 Contract | `RolesGuard(EMPLOYER)` | Chặn ở tầng Guard của Controller | `403` | `FORBIDDEN` |
| **T20** | `/api/v1/employer/jobs/:jobId/applications` | `GET` | Employer B | `EMPLOYER` (Job của Employer A) | M04 Contract | `M04Workflow.listCandidates` | Ủy quyền cho `JobAccessSource.assertManagedBy`; adapter từ chối vì không phải chủ sở hữu Job | `403` | `FORBIDDEN` |
| **T21** | `/api/v1/employer/applications/:id` | `GET` | Employer B | `EMPLOYER` (Đơn nộp vào Job của Employer A) | M04 Contract | `M04Workflow.getCandidate` | `PrismaM04Repository` đọc DB thật; ủy quyền `assertManagedBy` từ chối Employer không sở hữu Job | `403` | `FORBIDDEN` |
| **T22** | `/api/v1/employer/applications/:id/viewed` | `PATCH` | Employer B | `EMPLOYER` (Đơn nộp vào Job của Employer A) | M04 Contract | `M04Workflow.markViewed` | `PrismaM04Repository` đọc DB thật; ủy quyền `assertManagedBy` từ chối thao tác xem | `403` | `FORBIDDEN` |
| **T23** | `/api/v1/employer/applications/:id/reject` | `PATCH` | Employer B | `EMPLOYER` (Đơn nộp vào Job của Employer A) | M04 Contract | `M04Workflow.reject` | `PrismaM04Repository` đọc DB thật; ủy quyền `assertManagedBy` từ chối thao tác từ chối | `403` | `FORBIDDEN` |
