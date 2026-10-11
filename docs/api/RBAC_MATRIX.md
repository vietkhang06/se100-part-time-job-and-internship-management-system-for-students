# CAMPUSJOB — MA TRẬN PHÂN QUYỀN TRUY CẬP (RBAC MATRIX)

Tài liệu này xác định ma trận phân quyền dựa trên vai trò (Role-Based Access Control - RBAC) chính thức cho hệ thống CampusJob, đóng vai trò nguồn chân lý (Single Source of Truth) giữa Backend (`apps/api`), Frontend (`apps/web`), và gói hợp đồng dùng chung (`packages/contracts`).

---

## 1. Danh mục các Vai trò Hệ thống (System Roles)

Theo tài liệu kiến trúc `docs/ROLES_AND_STATES.md` và mã nguồn enum `UserRole` (`@campusjob/contracts`), hệ thống hỗ trợ 4 vai trò:

| Vai trò (`UserRole`) | Mô tả định danh | Quyền hạn nghiệp vụ chính |
|---|---|---|
| `STUDENT` | Sinh viên đang theo học hoặc mới tốt nghiệp | Tìm kiếm việc làm, lưu tin, nộp hồ sơ bằng CV snapshot, quản lý CV cá nhân, xác minh email trường (`.edu.vn`), xem lịch phỏng vấn, gửi đánh giá. |
| `EMPLOYER` | Nhà tuyển dụng / Đại diện pháp lý doanh nghiệp | Quản lý thông tin công ty, chi nhánh, đăng tin và quản lý tin tuyển dụng, xem CV snapshot ứng viên, chuyển trạng thái hồ sơ ứng tuyển, lên lịch phỏng vấn. |
| `MODERATOR` | Kiểm duyệt viên (Ban cán sự trường / Quản trị nội dung) | Thẩm định và duyệt hồ sơ doanh nghiệp mới, kiểm duyệt tin tuyển dụng trước khi công khai, xử lý khiếu nại và báo cáo vi phạm. |
| `ADMIN` | Quản trị viên cấp cao nhất của hệ thống | Toàn quyền kiểm soát hệ thống, quản lý tài khoản người dùng, phân quyền, xem nhật ký kiểm toán (Audit Log), cấu hình thông số và bảo trì hệ thống. |

---

## 2. Ma trận Phân quyền Endpoint (RBAC Matrix)

### 2.1 Các Endpoint hiện có trong Baseline (Active In-Scope Endpoints)

| Phương thức | Tuyến đường (Route) | Yêu cầu xác thực | Vai trò cho phép (`Allowed Roles`) | Hành vi khi thiếu xác thực | Hành vi khi sai vai trò | Nguồn quy chuẩn |
|---|---|---|---|---|---|---|
| `GET` | `/api/v1/health` | Public | Tất cả (Không cần token) | N/A (Trả về 200 OK) | N/A | FR-20, Milestone M3 |
| `POST` | `/api/v1/auth/register` | Public | Khách (Public) — Giới hạn DTO: `STUDENT`, `EMPLOYER` | N/A | 400 `ROLE_DISALLOWED` nếu cố tình gửi `ADMIN`/`MODERATOR` | FR-01, Contract C-01 |
| `POST` | `/api/v1/auth/login` | Public | Khách / Người dùng có tài khoản | N/A | 401 `INVALID_CREDENTIALS` | FR-01, Contract C-01 |
| `POST` | `/api/v1/auth/refresh` | Public (Yêu cầu Cookie) | Bất kỳ ai có refresh cookie hợp lệ | 401 `REFRESH_TOKEN_MISSING` | N/A | FR-02, Contract C-01 |
| `POST` | `/api/v1/auth/logout` | Public (Yêu cầu Cookie) | Idempotent (Bất kỳ client nào) | 200 OK (Xóa cookie) | N/A | FR-02, Contract C-01 |
| `POST` | `/api/v1/auth/logout-all` | Bearer Token (`JwtAuthGuard`) | `STUDENT`, `EMPLOYER`, `MODERATOR`, `ADMIN` (Tất cả vai trò) | 401 `UNAUTHORIZED` | N/A (Mọi vai trò hợp lệ đều được thu hồi phiên) | FR-02, Contract C-01 |
| `GET` | `/api/v1/auth/me` | Bearer Token (`JwtAuthGuard`) | `STUDENT`, `EMPLOYER`, `MODERATOR`, `ADMIN` (Tất cả vai trò) | 401 `UNAUTHORIZED` | N/A | FR-01, Contract C-01 |
| `POST` | `/api/v1/auth/verify-email` | Public | Khách mang token kích hoạt | 400 `VALIDATION_ERROR` nếu thiếu token | N/A | FR-03, Contract C-01 |
| `POST` | `/api/v1/auth/resend-verification` | Public | Khách mang email chưa xác minh | 400 `VALIDATION_ERROR` nếu thiếu email | N/A | FR-03, Contract C-01 |
| `POST` | `/api/v1/auth/forgot-password` | Public | Khách mang email | 400 `VALIDATION_ERROR` nếu thiếu email | N/A | FR-04, Contract C-01 |
| `POST` | `/api/v1/auth/reset-password` | Public | Khách mang token đặt lại mật khẩu | 400 `VALIDATION_ERROR` nếu thiếu token | N/A | FR-04, Contract C-01 |
| `GET` | `/api/v1/users/:id` | Công khai / Tra cứu | Chưa gán giới hạn vai trò (Chờ FR-05 / FR-19) | N/A (Trả về 200 / 404) | N/A | Khởi tạo ban đầu (Pending decision) |

### 2.2 Quy hoạch Phân quyền cho các Endpoint thuộc Scope Baseline (Planned FR Endpoints)

| Phân hệ / FR | Tuyến đường (Endpoint) | Yêu cầu xác thực | Vai trò cho phép (`Allowed Roles`) | Ghi chú chính sách |
|---|---|---|---|---|
| **FR-05: Hồ sơ cá nhân** | `GET /api/v1/users/me`<br>`PATCH /api/v1/users/me` | Authenticated | `STUDENT`, `EMPLOYER`, `MODERATOR`, `ADMIN` | Người dùng quản lý thông tin chính mình (Resource ownership). |
| **FR-06: Xác thực trường** | `POST /api/v1/students/verify-campus-email` | Authenticated | `STUDENT` | Chỉ sinh viên mới có nhu cầu xác minh email trường đại học. |
| **FR-07: Công ty & Chi nhánh** | `POST /api/v1/companies`<br>`POST /api/v1/companies/branches` | Authenticated | `EMPLOYER` | Chỉ nhà tuyển dụng tạo lập và quản lý doanh nghiệp. |
| **FR-08: Quản lý CV** | `GET /api/v1/resumes`<br>`POST /api/v1/resumes` | Authenticated | `STUDENT` | Chỉ sinh viên upload và quản lý hồ sơ ứng tuyển cá nhân. |
| **FR-09: Tin tuyển dụng** | `POST /api/v1/jobs`<br>`PATCH /api/v1/jobs/:id` | Authenticated | `EMPLOYER` | Doanh nghiệp tạo và chỉnh sửa tin tuyển dụng của công ty mình. |
| **FR-10: Tra cứu & Lưu tin** | `GET /api/v1/jobs`<br>`POST /api/v1/jobs/:id/save` | GET: Public<br>POST: Authenticated | GET: Public<br>POST: `STUDENT` | Xem tin tuyển dụng công khai; chỉ sinh viên lưu tin yêu thích. |
| **FR-11: Ứng tuyển CV Snapshot** | `POST /api/v1/jobs/:id/apply` | Authenticated | `STUDENT` | Chỉ sinh viên nộp hồ sơ ứng tuyển việc làm. |
| **FR-12: Trạng thái ứng tuyển** | `PATCH /api/v1/applications/:id/status` | Authenticated | `EMPLOYER` | Nhà tuyển dụng duyệt/từ chối/mời phỏng vấn ứng viên. |
| **FR-13: Lịch phỏng vấn** | `POST /api/v1/interviews`<br>`PATCH /api/v1/interviews/:id` | Authenticated | `EMPLOYER` (Tạo/Sửa)<br>`STUDENT` (Xác nhận) | Phân tách quyền tạo lịch và phản hồi xác nhận. |
| **FR-14: Đánh giá công ty** | `POST /api/v1/reviews`<br>`GET /api/v1/reviews` | POST: Authenticated<br>GET: Public | POST: `STUDENT`<br>GET: Public | Sinh viên đánh giá công ty; cộng đồng xem công khai. |
| **FR-15: Báo cáo vi phạm** | `POST /api/v1/reports` | Authenticated | `STUDENT`, `EMPLOYER` | Ứng viên hoặc doanh nghiệp gửi báo cáo vi phạm. |
| **FR-16: Kiểm duyệt nội dung** | `PATCH /api/v1/moderation/jobs/:id`<br>`PATCH /api/v1/moderation/companies/:id` | Authenticated | `MODERATOR`, `ADMIN` | Chỉ kiểm duyệt viên và admin được phê duyệt tin/công ty. |
| **FR-17: Thông báo** | `GET /api/v1/notifications`<br>`PATCH /api/v1/notifications/:id/read` | Authenticated | `STUDENT`, `EMPLOYER`, `MODERATOR`, `ADMIN` | Nhận thông báo liên quan đến tài khoản cá nhân. |
| **FR-18: Quản lý tệp tin** | `POST /api/v1/storage/upload` | Authenticated | `STUDENT`, `EMPLOYER`, `MODERATOR`, `ADMIN` | Upload avatar, CV, giấy tờ pháp lý có kiểm tra quota. |
| **FR-19: Quản trị & Audit** | `GET /api/v1/admin/users`<br>`GET /api/v1/admin/audit-logs` | Authenticated | `ADMIN` | Chỉ quản trị viên tối cao được xem audit logs và quản lý user. |

---

## 3. Kiến trúc và Cơ chế Thực thi Phân quyền (Mechanism & Execution)

### 3.1 Luồng phối hợp giữa `JwtAuthGuard` và `RolesGuard`

Quá trình kiểm soát quyền truy cập tuân theo mô hình 2 lớp bảo vệ tuần tự:

```text
[HTTP Request]
       │
       ▼
[Global Exception Filter & Middleware]
       │
       ▼
[1. JwtAuthGuard]
       │
       ├── Đánh dấu @Public()? ──(Yes)──> Cho phép đi tiếp (Bỏ qua JWT check)
       │
       └── Yêu cầu Token? ──(No Token/Invalid)──> 401 Unauthorized (AuthErrorCode.UNAUTHORIZED)
                 │
                 ├── Kiểm tra tài khoản trong DB? ──(SUSPENDED/LOCKED)──> 403 Forbidden (ACCOUNT_SUSPENDED / ACCOUNT_LOCKED)
                 │
                 └── Token hợp lệ & User ACTIVE ──> Gắn req.user vào request
                                                          │
                                                          ▼
                                                   [2. RolesGuard]
                                                          │
                                                          ├── Tuyến đường là @Public()? ──(Yes)──> Cho phép (Pass)
                                                          │
                                                          ├── Không có @Roles()? ──(Yes)──> Cho phép mọi authenticated user (Pass)
                                                          │
                                                          └── Có @Roles(AllowedRoles)?
                                                                    │
                                                                    ├── Thiếu req.user? ──(Yes)──> 401 Unauthorized (AuthErrorCode.UNAUTHORIZED)
                                                                    │
                                                                    ├── req.user.role ∈ AllowedRoles? ──(Yes)──> Cho phép (Pass)
                                                                    │
                                                                    └── req.user.role ∉ AllowedRoles? ──(No)──> 403 Forbidden (AuthErrorCode.FORBIDDEN)
                                                                                                                    │
                                                                                                                    ▼
                                                                                                     [Route Handler Execution]
```

### 3.2 Quy tắc Ưu tiên Metadata (Metadata Precedence)
- `RolesGuard` sử dụng `Reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()])`.
- **Precedence Rule:** Metadata khai báo tại cấp phương thức (Route Handler) **luôn ghi đè (override)** metadata tại cấp Controller (Class). Nếu phương thức không khai báo `@Roles(...)`, quyền hạn sẽ được kế thừa từ Controller.

### 3.3 Phòng chống giả mạo vai trò từ phía Client (Role Tampering Prevention)
- `RolesGuard` **tuyệt đối không tin tưởng** bất kỳ thông tin vai trò nào được gửi từ client thông qua Query parameters (`?role=ADMIN`), Request headers (`X-Role`, `X-User-Role`), hay Request body (`{ role: 'ADMIN' }`).
- Vai trò của người dùng được trích xuất duy nhất từ `req.user.role`, được `JwtStrategy` kiểm tra và xác thực từ bản ghi cơ sở dữ liệu PostgreSQL thực tế khi giải mã JWT Bearer Token hợp lệ.

---

## 4. Định dạng Payload Lỗi Phân quyền

### 4.1 Lỗi Chưa Đăng nhập (401 Unauthorized)
```json
{
  "statusCode": 401,
  "message": "Vui lòng đăng nhập để tiếp tục.",
  "error": "Unauthorized",
  "code": "UNAUTHORIZED",
  "timestamp": "2026-10-11T12:00:00.000Z",
  "path": "/api/v1/admin/users",
  "correlationId": "488821ca-d339-4f4f-bd04-f9a5e7744601"
}
```

### 4.2 Lỗi Không đủ Quyền hạn Vai trò (403 Forbidden)
```json
{
  "statusCode": 403,
  "message": "Bạn không có quyền truy cập tài nguyên này.",
  "error": "Forbidden",
  "code": "FORBIDDEN",
  "timestamp": "2026-10-11T12:00:00.000Z",
  "path": "/api/v1/admin/users",
  "correlationId": "488821ca-d339-4f4f-bd04-f9a5e7744601"
}
```

---

## 5. Kết luận Kiểm toán Kích hoạt trên Tuyến đường Sản xuất (Production Wiring Audit)

1. **Bản chất hiện thực hóa:** Hiện thực hóa RBAC trong task S2-M01-02 là một **Cơ chế phân quyền tái sử dụng (Reusable Authorization Mechanism)**, hoàn chỉnh về mặt hạ tầng (`@Roles`, `RolesGuard`, mã lỗi `FORBIDDEN`, unit tests, E2E tests).
2. **Trạng thái đăng ký Guard:** `RolesGuard` được khai báo provider và export tại `AuthModule`. Guard **không** đăng ký dạng `APP_GUARD` toàn cục (đúng theo quy ước kiến trúc NestJS của dự án: áp dụng tường minh qua `@UseGuards(JwtAuthGuard, RolesGuard)`).
3. **Trạng thái kích hoạt trên Route sản xuất:** **Chưa kích hoạt trên bất kỳ route sản xuất nào**, vì toàn bộ các endpoint sản xuất hiện có trong repository đều là Public hoặc cho phép tất cả vai trò đã đăng nhập (`/auth/me`, `/auth/logout-all`). Endpoint `GET /api/v1/users/:id` là mã scaffold ban đầu chưa có yêu cầu phân quyền được phê duyệt.
4. **Phân biệt Route kiểm thử E2E:** 21 test case trong `apps/api/test/rbac.e2e-spec.ts` kiểm thử trên 2 controller thử nghiệm (`RbacTestController`, `RbacPrecedenceTestController`) gắn vào fixture test, tương tác với tài khoản thật và token thật sinh ra từ PostgreSQL qua endpoint sản xuất `POST /api/v1/auth/login`.
5. **Kích hoạt thực tế trong tương lai:** Việc kích hoạt `@Roles(...)` trên các route sản xuất sẽ diễn ra tại các task nghiệp vụ tương ứng (S2-M01-03+, FR-06, FR-07, FR-09, FR-16, FR-19) khi các controller sản xuất đó được triển khai.
