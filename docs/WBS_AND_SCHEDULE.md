# CAMPUSJOB — CƠ CẤU BẺ NHỎ CÔNG VIỆC VÀ TIẾN ĐỘ (WBS & SCHEDULE)

## I. WORK BREAKDOWN STRUCTURE (WBS)

### 1. Nền tảng & Hạ tầng (Platform & Infrastructure)
- 1.1 Khởi tạo Monorepo pnpm, TypeScript strict.
- 1.2 Thiết lập Docker Compose độc lập (`campusjob-official`): PostgreSQL 16 & Mailpit.
- 1.3 Thiết lập môi trường và biến môi trường chuẩn hóa (`.env.example`).
- 1.4 Thiết lập CI pipeline (Lint, Typecheck, Test, Build).

### 2. Kiến trúc & Dữ liệu Backend (Backend Foundation & Data Model)
- 2.1 Prisma Schema tài khoản tối thiểu (`User`, `AuthSession`, `EmailVerificationToken`, `PasswordResetToken`, `AuditLog`).
- 2.2 CLI khởi tạo quản trị viên đầu tiên (`admin:create`).
- 2.3 NestJS Modular Monolith kiến trúc sạch (Domain, Application, Infrastructure, Presentation).
- 2.4 Middleware & Bộ lọc chung: Request ID, Global Exception Filter, Validation Pipe, Cookie Parser, Swagger `/docs`.
- 2.5 Healthcheck endpoint (`GET /api/v1/health`) giám sát DB connectivity.

### 3. Giao diện & Trải nghiệm Frontend (Frontend Architecture & Components)
- 3.1 Next.js App Router chia Route Groups: `(public)`, `(auth)`, `candidate`, `employer`, `moderator`, `admin`.
- 3.2 Bộ component nền: Button, Input, Select, Card, Badge, Dialog, Alert, Spinner, EmptyState, ErrorState.
- 3.3 Hệ thống Layout phân quyền và Navigation config.
- 3.4 API Client đồng bộ trạng thái và token an toàn.

### 4. Gói hợp đồng dùng chung (Shared Contracts)
- 4.1 Định nghĩa Enum vai trò, trạng thái.
- 4.2 Định nghĩa DTO giao tiếp chuẩn (`ApiErrorResponse`, `HealthResponseDto`, `PaginationMeta`, `PaginatedResponse<T>`).

---

## II. LỘ TRÌNH TIẾN ĐỘ THEO CHECKPOINT (SCHEDULE MILESTONES)

| Cột mốc | Nội dung công việc | Mục tiêu kiểm chứng | Trạng thái |
|---|---|---|---|
| **M1** | Base Monorepo & Infra setup | Docker up cô lập, PostgreSQL & Mailpit thông suốt | Hoàn thành |
| **M2** | Core Data Model & Migrations | Schema Prisma hợp lệ, migration chạy thành công | Hoàn thành |
| **M3** | Backend Modular Architecture | Health endpoint trả HTTP 200 kèm trạng thái DB | Hoàn thành |
| **M4** | Frontend Route Groups & UI Core | Build thành công Next.js, không lỗi TypeScript | Hoàn thành |
| **M5** | Quality Gates & CI Pipeline | Lint, Typecheck, Test, Build toàn bộ xanh | Hoàn thành |
| **M6** | Baseline Documentation & Runbook | README máy sạch, đầy đủ kịch bản vận hành | Hoàn thành |
