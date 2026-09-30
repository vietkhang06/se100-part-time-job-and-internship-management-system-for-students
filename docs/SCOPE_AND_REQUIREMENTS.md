# CAMPUSJOB — PHẠM VI DỰ ÁN VÀ MA TRẬN YÊU CẦU (SCOPE & REQUIREMENTS)

## I. KHÓA PHẠM VI DỰ ÁN (SCOPE BASELINE)

### 1. CORE SCOPE (BẮT BUỘC TRONG BASELINE)
Hệ thống CampusJob trong giai đoạn nền tảng tập trung triển khai đầy đủ và thực chất 20 phân hệ nghiệp vụ sau:

1. **Đăng ký tài khoản (User Registration):** Đăng ký tài khoản cho Sinh viên (Student) và Nhà tuyển dụng (Employer) với validation chuẩn hóa, mật khẩu mã hóa Argon2id.
2. **Xác minh email (Email Verification):** Gửi email chứa token băm qua Mailpit/SMTP, kích hoạt trạng thái tài khoản `ACTIVE`.
3. **Đăng nhập, refresh, logout và logout-all (Authentication & Session Management):** Access token JWT ngắn hạn (15m), Refresh token lưu trong HttpOnly cookie với token family và revoking khi phát hiện tái sử dụng.
4. **Quên, đặt lại và đổi mật khẩu (Password Management):** Gửi link đặt lại mật khẩu với token băm có thời hạn, đổi mật khẩu an toàn khi đang đăng nhập.
5. **Hồ sơ cá nhân (User Profile):** Quản lý thông tin cá nhân của ứng viên/nhà tuyển dụng (họ tên, số điện thoại, avatar, tiểu sử).
6. **Xác thực email trường cho sinh viên (Campus Email Verification):** Nhập và xác thực email trường (.edu.vn), cấp huy hiệu đã xác minh sinh viên chính quy.
7. **Hồ sơ doanh nghiệp (Company Profile):** Khởi tạo, cập nhật thông tin pháp lý doanh nghiệp, logo, website, quy mô công ty.
8. **Chi nhánh doanh nghiệp (Company Branches):** Quản lý nhiều văn phòng/địa điểm làm việc của doanh nghiệp phục vụ gắn tin tuyển dụng.
9. **Quản lý CV (Resume/CV Management):** Sinh viên tải lên tệp CV (PDF/DOCX) hoặc tạo CV trực tuyến; kiểm tra định dạng và kích thước tệp.
10. **Tin tuyển dụng (Job Postings):** Doanh nghiệp tạo, cập nhật tin tuyển dụng (part-time/internship), chỉ định mức lương, thời gian làm việc, yêu cầu và địa điểm.
11. **Tìm kiếm và lưu việc (Job Search & Bookmarks):** Tìm kiếm tin tuyển dụng theo từ khóa, ngành nghề, hình thức làm việc, mức lương; sinh viên lưu tin yêu thích.
12. **Ứng tuyển bằng CV snapshot (Job Application):** Sinh viên nộp hồ sơ vào tin tuyển dụng; hệ thống lưu bản chụp (snapshot) CV tại thời điểm nộp để tránh việc ứng viên thay đổi CV sau khi ứng tuyển làm sai lệch hồ sơ.
13. **Trạng thái ứng tuyển (Application Status Workflow):** Quy trình chuyển trạng thái minh bạch: `SUBMITTED` → `REVIEWING` → `INTERVIEW_SCHEDULED` → `ACCEPTED` / `REJECTED`.
14. **Quản lý phỏng vấn (Interview Scheduling):** Nhà tuyển dụng đặt lịch phỏng vấn (thời gian, địa điểm/link online, ghi chú), sinh viên nhận thông báo và xác nhận.
15. **Đánh giá doanh nghiệp (Company Reviews):** Sinh viên đã hoàn thành công việc/thực tập gửi đánh giá trải nghiệm thực tế; có kiểm duyệt trước khi hiển thị.
16. **Báo cáo và khiếu nại (Reporting & Abuse Handling):** Báo cáo tin tuyển dụng vi phạm, doanh nghiệp gian lận hoặc ứng viên không trung thực.
17. **Kiểm duyệt (Moderation):** Kiểm duyệt viên/Admin duyệt hồ sơ doanh nghiệp mới, duyệt tin tuyển dụng, xử lý khiếu nại vi phạm.
18. **Thông báo (Notifications):** Thông báo in-app và gửi email thông báo khi có thay đổi trạng thái hồ sơ, lịch phỏng vấn, kết quả duyệt tin.
19. **Tệp tin và lưu trữ (File Management):** Quản lý tệp tải lên (Avatar, CV, Giấy phép kinh doanh) lưu trữ an toàn trên local filesystem (development) và chuẩn bị adapter S3 (production).
20. **Quản trị và Audit (Admin & Audit Logs):** Quản lý người dùng, khóa/mở khóa tài khoản, ghi nhật ký kiểm toán (actorId, action, entityType, entityId, ipAddress, metadata) cho mọi thao tác nhạy cảm; duy trì cơ chế bảo trì hệ thống.

---

### 2. PHASE 2 (GIAI ĐOẠN 2 — KHÔNG TRIỂN KHAI TRONG BASELINE)
Các tính năng sau đã được ghi nhận trong lộ trình phát triển nhưng TUYỆT ĐỐI KHÔNG triển khai ở baseline:
- **Messaging (Trò chuyện trực tiếp):** Trao đổi tin nhắn real-time giữa ứng viên và nhà tuyển dụng.
- **Payment (Thanh toán):** Cổng thanh toán hóa đơn.
- **Stripe Checkout:** Tích hợp thanh toán quốc tế bằng thẻ tín dụng.
- **Service Plans (Gói dịch vụ):** Các gói thành viên trả phí dành cho nhà tuyển dụng.
- **Featured Jobs (Tin tuyển dụng nổi bật):** Quảng cáo tin tuyển dụng ưu tiên lên đầu trang.
- **AI Recommendation nâng cao:** Mô hình học sâu/vector embedding để gợi ý việc làm phức tạp.

---

### 3. OUT OF SCOPE (NGOÀI PHẠM VI HOÀN TOÀN)
- Đăng nhập bằng ChatGPT SSO / AI bot.
- Lưu trữ cơ sở dữ liệu Cloudflare D1 / R2.
- WebMCP Search protocol.
- Tự động ra quyết định tuyển dụng mà không có sự tham gia của con người.
- Ứng dụng native mobile (Android/iOS).

---

## II. MA TRẬN TRUY VẾT YÊU CẦU (TRACEABILITY MATRIX)
**FR → UC → Domain → API → UI → Test**

| FR ID | Tên chức năng | Use Case | Domain Entity | REST API Endpoint | Giao diện UI (Route) | Test Suite |
|---|---|---|---|---|---|---|
| **FR-01** | Đăng ký & Đăng nhập | UC-01: Đăng ký / UC-02: Đăng nhập | `User`, `AuthSession` | `POST /api/v1/auth/register`<br>`POST /api/v1/auth/login` | `/(auth)/register`<br>`/(auth)/login` | `auth.e2e-spec.ts` |
| **FR-02** | Refresh token & Đăng xuất | UC-03: Refresh / UC-04: Logout | `AuthSession` | `POST /api/v1/auth/refresh`<br>`POST /api/v1/auth/logout` | `Header Profile Dropdown` | `auth.e2e-spec.ts` |
| **FR-03** | Xác minh email | UC-05: Xác minh email qua token | `EmailVerificationToken` | `POST /api/v1/auth/verify-email` | `/(auth)/verify-email` | `auth.e2e-spec.ts` |
| **FR-04** | Quên & Đặt lại mật khẩu | UC-06: Khôi phục mật khẩu | `PasswordResetToken` | `POST /api/v1/auth/forgot-password`<br>`POST /api/v1/auth/reset-password` | `/(auth)/forgot-password`<br>`/(auth)/reset-password` | `auth.e2e-spec.ts` |
| **FR-05** | Hồ sơ cá nhân | UC-07: Xem/Cập nhật thông tin | `User`, `UserProfile` | `GET /api/v1/users/me`<br>`PATCH /api/v1/users/me` | `/candidate/profile`<br>`/employer/company` | `users.e2e-spec.ts` |
| **FR-06** | Xác thực email trường | UC-08: Gửi mã & xác nhận trường | `StudentCampusVerification` | `POST /api/v1/students/verify-campus-email` | `/candidate/profile` | `students.spec.ts` |
| **FR-07** | Hồ sơ doanh nghiệp & Chi nhánh | UC-09: Quản lý công ty / chi nhánh | `Company`, `CompanyBranch` | `POST /api/v1/companies`<br>`POST /api/v1/companies/branches` | `/employer/company`<br>`/employer/branches` | `companies.spec.ts` |
| **FR-08** | Quản lý CV sinh viên | UC-10: Upload/Quản lý CV | `Resume` | `GET /api/v1/resumes`<br>`POST /api/v1/resumes` | `/candidate/cvs` | `resumes.spec.ts` |
| **FR-09** | Đăng tin & Quản lý tin tuyển dụng | UC-11: Tạo/Sửa tin tuyển dụng | `JobPosting` | `POST /api/v1/jobs`<br>`PATCH /api/v1/jobs/:id` | `/employer/jobs` | `jobs.spec.ts` |
| **FR-10** | Tìm kiếm & Lưu việc làm | UC-12: Tra cứu & Lưu tin | `JobPosting`, `SavedJob` | `GET /api/v1/jobs`<br>`POST /api/v1/jobs/:id/save` | `/(public)/jobs`<br>`/candidate/saved-jobs` | `jobs.spec.ts` |
| **FR-11** | Ứng tuyển bằng CV snapshot | UC-13: Nộp hồ sơ ứng tuyển | `Application`, `ResumeSnapshot` | `POST /api/v1/jobs/:id/apply` | `/(public)/jobs/:id` | `applications.spec.ts` |
| **FR-12** | Quản lý quy trình ứng tuyển | UC-14: Cập nhật trạng thái hồ sơ | `Application` | `PATCH /api/v1/applications/:id/status` | `/employer/applications`<br>`/candidate/applications` | `applications.spec.ts` |
| **FR-13** | Quản lý lịch phỏng vấn | UC-15: Đặt lịch phỏng vấn | `Interview` | `POST /api/v1/interviews`<br>`PATCH /api/v1/interviews/:id` | `/employer/interviews`<br>`/candidate/interviews` | `interviews.spec.ts` |
| **FR-14** | Đánh giá doanh nghiệp | UC-16: Đăng & đọc đánh giá | `CompanyReview` | `POST /api/v1/reviews`<br>`GET /api/v1/reviews` | `/(public)/companies/:id` | `reviews.spec.ts` |
| **FR-15** | Báo cáo vi phạm | UC-17: Gửi báo cáo xấu | `AbuseReport` | `POST /api/v1/reports` | Dialog Báo cáo trên web | `reports.spec.ts` |
| **FR-16** | Kiểm duyệt nội dung | UC-18: Duyệt tin, duyệt công ty | `JobPosting`, `Company` | `PATCH /api/v1/moderation/jobs/:id`<br>`PATCH /api/v1/moderation/companies/:id` | `/moderator/moderation` | `moderation.spec.ts` |
| **FR-17** | Thông báo hệ thống | UC-19: Nhận & đọc thông báo | `Notification` | `GET /api/v1/notifications`<br>`PATCH /api/v1/notifications/:id/read` | `AppHeader Notification Bell` | `notifications.spec.ts` |
| **FR-18** | Quản lý tải lên tệp tin | UC-20: Upload avatar/CV/giấy tờ | `StorageFile` | `POST /api/v1/storage/upload` | Upload UI components | `storage.spec.ts` |
| **FR-19** | Quản trị người dùng & Audit | UC-21: Quản trị tài khoản, Audit log | `User`, `AuditLog` | `GET /api/v1/admin/users`<br>`GET /api/v1/admin/audit-logs` | `/admin/users`<br>`/admin/reports` | `admin.spec.ts` |
| **FR-20** | Healthcheck & Vận hành | UC-22: Giám sát trạng thái hệ thống | `SystemHealth` | `GET /api/v1/health` | Status monitoring | `app.e2e-spec.ts` |
