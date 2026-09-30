# CAMPUSJOB — PROJECT CHARTER

## 1. Tên dự án & Bối cảnh
- **Tên dự án:** CampusJob — Part-time Job and Internship Management System for Students.
- **Bối cảnh:** Nền tảng kết nối trực tiếp sinh viên đại học với các doanh nghiệp, nhà tuyển dụng có nhu cầu tuyển sinh viên làm bán thời gian (part-time), thực tập (internship) hoặc dự án ngắn hạn; được giám sát và bảo đảm bởi nhà trường và đội ngũ kiểm duyệt.

## 2. Tầm nhìn & Mục tiêu (Objectives)
- **Tầm nhìn:** Trở thành hệ sinh thái hướng nghiệp và kết nối việc làm sinh viên chuẩn mực, an toàn, minh bạch và hiệu quả nhất cho sinh viên đại học.
- **Mục tiêu cốt lõi:**
  1. Cung cấp nền tảng quản lý hồ sơ ứng viên (CV), tin tuyển dụng, quy trình phỏng vấn và trạng thái ứng tuyển chuẩn hóa.
  2. Xác thực định danh sinh viên qua email trường (.edu.vn / domain đại học).
  3. Kiểm duyệt chặt chẽ doanh nghiệp và tin tuyển dụng để ngăn chặn lừa đảo, đa cấp, việc làm độc hại.
  4. Duy trì nhật ký kiểm toán (Audit Trail) cho toàn bộ các thay đổi nhạy cảm trong hệ thống.
  5. Đạt hiệu năng cao, mở rộng linh hoạt theo mô hình Monorepo (NestJS Modular Monolith + Next.js App Router).

## 3. Các bên liên quan (Stakeholders)
- **Sponsor / Giảng viên hướng dẫn:** SE100 Course Faculty.
- **Project Lead / Tech Lead:** Antigravity Engineering Lead.
- **Thành viên phát triển:** Nhóm sinh viên kỹ thuật phần mềm (Nhóm 11).
- **Người dùng mục tiêu:** Sinh viên (Candidates), Doanh nghiệp (Employers), Kiểm duyệt viên (Moderators), Quản trị viên hệ thống (Admins).

## 4. Ranh giới dự án (Boundaries)
- **In-Scope (Baseline):** Xác thực tài khoản đa vai trò, hồ sơ sinh viên & xác thực trường, hồ sơ công ty & chi nhánh, quản lý CV, đăng tin & duyệt tin, tìm kiếm việc làm, nộp CV snapshot, quản lý tuyển dụng & phỏng vấn, đánh giá, khiếu nại/báo cáo, quản lý người dùng, audit log, file storage nội bộ.
- **Out-of-Scope (Baseline):** Thanh toán trực tuyến (Stripe/Payment gateway), Chat/Messaging trực tiếp, Thuật toán AI matching phức tạp, Tự động hóa tuyển dụng không có người duyệt, Ứng dụng di động native.

## 5. Nguyên tắc kiến trúc & Tiêu chuẩn kỹ thuật
- **Codebase:** pnpm workspace monorepo, TypeScript strict mode toàn diện.
- **Backend:** NestJS 11, Clean Architecture / Modular Monolith, PostgreSQL 16 qua Prisma ORM, Passport JWT + HttpOnly refresh cookies, Argon2id băm mật khẩu.
- **Frontend:** Next.js 15+ App Router, Tailwind CSS, Component nền chuẩn Accessibility & Responsive, tách biệt hoàn toàn layout theo vai trò.
- **Hạ tầng:** Docker Compose cô lập (`campusjob-official`), Mailpit cho local email testing. Không mock dữ liệu nghiệp vụ, không seed dữ liệu giả.
