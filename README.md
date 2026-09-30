# CampusJob — Part-time Job & Internship Management System for Students

Hệ thống quản lý việc làm bán thời gian và thực tập cho sinh viên đại học, được xây dựng theo mô hình Monorepo hiệu năng cao.

---

## 1. Giới thiệu CampusJob
CampusJob giải quyết bài toán tìm kiếm việc làm thêm và thực tập chất lượng, an toàn cho sinh viên. Hệ thống kết nối sinh viên trực tiếp với các doanh nghiệp uy tín, bảo đảm bởi cơ chế:
- Xác thực định danh sinh viên qua email trường (.edu.vn).
- Ứng tuyển với tính năng CV Snapshot (lưu bản chụp CV tại thời điểm nộp đơn, chống sửa đổi làm sai lệch hồ sơ).
- Quy trình phỏng vấn và trạng thái ứng tuyển minh bạch.
- Đội ngũ kiểm duyệt viên (Moderators) kiểm định doanh nghiệp và tin tuyển dụng.
- Lưu vết toàn bộ thay đổi qua hệ thống Audit Log.

---

## 2. Phạm vi dự án (Scope)

### Core Scope (Hoàn thành ở Baseline)
1. Đăng ký tài khoản (Student, Employer).
2. Xác minh email qua token băm gửi qua SMTP/Mailpit.
3. Đăng nhập, refresh token với Token Family, logout và logout-all.
4. Quên, đặt lại và đổi mật khẩu an toàn (Argon2id).
5. Hồ sơ cá nhân người dùng.
6. Xác thực email trường đại học.
7. Hồ sơ doanh nghiệp và thông tin pháp lý.
8. Quản lý chi nhánh & địa điểm làm việc.
9. Quản lý CV sinh viên (PDF/DOCX).
10. Đăng tin và quản lý tin tuyển dụng part-time / internship.
11. Tìm kiếm, lọc và lưu tin việc làm.
12. Ứng tuyển bằng CV snapshot chống gian lận.
13. Quy trình trạng thái hồ sơ ứng tuyển minh bạch.
14. Quản lý lịch hẹn phỏng vấn.
15. Đánh giá doanh nghiệp từ trải nghiệm thực tế.
16. Báo cáo vi phạm và giải quyết khiếu nại.
17. Kiểm duyệt doanh nghiệp và tin tuyển dụng.
18. Thông báo in-app và email.
19. Quản lý lưu trữ tệp (Local storage dev, chuẩn bị S3 adapter).
20. Bảng điều khiển quản trị, Audit Log và chế độ bảo trì.

### Phase 2 (Giai đoạn sau — Không có trong baseline)
- Tin nhắn thời gian thực (Messaging / Chat).
- Thanh toán trực tuyến (Stripe Checkout / Payment gateway).
- Gói dịch vụ trả phí dành cho nhà tuyển dụng.
- Tin tuyển dụng nổi bật (Featured jobs).
- Gợi ý việc làm nâng cao bằng AI vector embedding.

### Ngoài phạm vi hoàn toàn (Out of Scope)
- Đăng nhập bằng ChatGPT SSO / AI bot.
- Cơ sở dữ liệu Cloudflare D1 / R2.
- Giao thức WebMCP.
- Tuyển dụng tự động không qua con người.
- Ứng dụng native mobile.

---

## 3. Tech Stack

- **Monorepo:** pnpm workspace, TypeScript strict.
- **Backend:** NestJS 11, PostgreSQL 16 Alpine, Prisma ORM, Passport JWT, Argon2id, class-validator, Swagger/OpenAPI (`/docs`).
- **Frontend:** Next.js 15+ App Router, React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Hạ tầng:** Docker Compose (project `campusjob-official`), Mailpit v1.18 (Email testing local).
- **Kiểm thử:** Jest, Supertest (E2E trên PostgreSQL thực tế, không mock dữ liệu).

---

## 4. Cấu trúc thư mục

```
.
├── .github/
│   ├── workflows/ci.yml       # CI pipeline (lint, typecheck, test, build)
│   ├── pull_request_template.md
│   └── CODEOWNERS
├── apps/
│   ├── api/                   # Backend NestJS 11
│   │   ├── prisma/            # Schema và migrations
│   │   ├── src/
│   │   │   ├── cli/           # CLI khởi tạo Admin
│   │   │   ├── modules/       # Các modules nghiệp vụ (Health, Users, ...)
│   │   │   └── shared/        # Database, filter, middleware
│   │   └── test/              # E2E test suites
│   └── web/                   # Frontend Next.js App Router
│       └── src/
│           ├── app/           # Route groups ((public), (auth), candidate, employer, moderator, admin)
│           ├── components/    # ui, layout, providers
│           ├── config/        # Navigation config
│           └── lib/           # Api client & utilities
├── docs/                      # Toàn bộ tài liệu kiến trúc, đặc tả, WBS, test plan
├── infra/
│   └── docker-compose.yml     # Docker Compose cô lập (PostgreSQL & Mailpit)
├── packages/
│   └── contracts/             # Shared TypeScript types, enums, DTOs
├── .env.example               # Mẫu cấu hình môi trường chuẩn
├── package.json               # Root scripts
└── pnpm-workspace.yaml        # Khai báo workspace apps/* và packages/*
```

---

## 5. Điều kiện tiên quyết (Prerequisites)

- **Hệ điều hành:** Windows 10/11, macOS, hoặc Linux Ubuntu 22.04+.
- **Git:** >= 2.40.
- **Node.js:** >= 20.0.0 hoặc Node 22 LTS (Khuyến nghị).
- **pnpm:** >= 10.0.0 (Hiện tại: 11.25.0).
- **Docker Desktop:** Đang chạy (hỗ trợ Linux containers).

---

## 6. Hướng dẫn Clone Repository

```bash
git clone https://github.com/vietkhang06/se100-part-time-job-and-internship-management-system-for-students.git campusjob
cd campusjob
```

---

## 7. Khởi tạo tệp môi trường (.env)

Sao chép từ `.env.example`:

**Trên Windows PowerShell:**
```powershell
Copy-Item .env.example .env
```

**Trên Windows Command Prompt (CMD):**
```cmd
copy .env.example .env
```

**Trên Linux / macOS:**
```bash
cp .env.example .env
```

> **LƯU Ý:** Tuyệt đối không commit tệp `.env` lên Git. `.env` đã được cấu hình trong `.gitignore`.

---

## 8. Bảng phân bổ cổng mạng thực tế (Port Mapping)

Để tránh xung đột với các container sẵn có trên máy:

| Dịch vụ | Cổng Host (Máy) | Cổng Container | Ghi chú |
|---|---|---|---|
| **Frontend Web** | `3000` | - | http://localhost:3000 |
| **Backend REST API** | `8080` | - | http://localhost:8080/api/v1 (Docs: `/docs`) |
| **PostgreSQL 16** | `5435` | `5432` | Tránh cổng 5432, 5433, 5434 cũ |
| **Mailpit SMTP** | `1026` | `1025` | Nhận email từ API (tránh 1025 cũ) |
| **Mailpit Web UI** | `8026` | `8025` | Xem giao diện hộp thư: http://localhost:8026 |

---

## 9. Khởi động hạ tầng Docker

Chỉ khởi động project độc lập `campusjob-official`:

```bash
pnpm infra:up
```

Kiểm tra trạng thái container:
```bash
pnpm infra:ps
```

Xem log container:
```bash
pnpm infra:logs
```

Dừng container:
```bash
pnpm infra:down
```

---

## 10. Kiểm tra PostgreSQL

Kiểm tra xem container PostgreSQL đã chuyển sang trạng thái `healthy`:

```bash
docker ps --filter "name=campusjob-official-postgres"
```

Chuỗi kết nối:
```
postgresql://campusjob:campusjob_dev@localhost:5435/campusjob?schema=public
```

---

## 11. Kiểm tra Mailpit

Mở trình duyệt truy cập:
```
http://localhost:8026
```
Nếu giao diện hòm thư Mailpit mở ra bình thường là hạ tầng email đã sẵn sàng.

---

## 12. Cài đặt Dependencies

Tại thư mục gốc của repository:

```bash
pnpm install
```

---

## 13. Khởi tạo Prisma Client

Sinh mã TypeScript cho Prisma Client:

```bash
pnpm db:generate
```

---

## 14. Chạy Migration Database

Áp dụng cấu trúc bảng vào PostgreSQL mới:

```bash
pnpm db:migrate
```

Để mở giao diện trực quan Prisma Studio:
```bash
pnpm db:studio
```

---

## 15. Tạo tài khoản Quản trị viên (Admin) đầu tiên

Tài khoản quản trị viên **không** được tạo tự động khi khởi động mà phải chạy qua lệnh CLI an toàn:

**Chạy với biến môi trường tạm:**
```bash
# Windows PowerShell:
$env:ADMIN_PASSWORD="MySecureAdminPass123!"; pnpm admin:create --email admin@campusjob.local --name "Tong Quan Tri Vien"

# Windows CMD:
set ADMIN_PASSWORD=MySecureAdminPass123! && pnpm admin:create --email admin@campusjob.local --name "Tong Quan Tri Vien"

# Linux / macOS:
ADMIN_PASSWORD="MySecureAdminPass123!" pnpm admin:create --email admin@campusjob.local --name "Tong Quan Tri Vien"
```

Nếu không truyền `ADMIN_PASSWORD`, CLI sẽ hiện prompt yêu cầu nhập mật khẩu trên terminal (tối thiểu 8 ký tự).

---

## 16. Chạy riêng Backend API

```bash
pnpm dev:api
```
- API Base URL: `http://localhost:8080/api/v1`
- Healthcheck: `http://localhost:8080/api/v1/health`
- Swagger UI: `http://localhost:8080/docs`

---

## 17. Chạy riêng Frontend Web

```bash
pnpm dev:web
```
- Web Application: `http://localhost:3000`

---

## 18. Chạy đồng thời cả Hệ thống (API & Web)

```bash
pnpm dev
```
Lệnh này sử dụng `concurrently` để chạy song song cả `@campusjob/api` và `@campusjob/web`.

---

## 19. Kiểm tra chất lượng mã (Lint, Typecheck, Test, Build)

Chạy từng bước:
```bash
pnpm typecheck   # Kiểm tra kiểu TypeScript toàn bộ monorepo
pnpm lint        # Kiểm tra quy chuẩn mã nguồn
pnpm test        # Chạy Unit Tests
pnpm test:e2e    # Chạy E2E Tests trên PostgreSQL thực tế
pnpm build       # Biên dịch toàn bộ gói và ứng dụng
```

Hoặc chạy toàn bộ kiểm tra qua lệnh tổng hợp:
```bash
pnpm verify
```

---

## 20. Hướng dẫn xử lý các lỗi thường gặp (Troubleshooting)

### Lỗi 1: `Docker daemon is not running`
- **Hiện tượng:** Chạy `pnpm infra:up` báo lỗi `error during connect: ... docker desktop is not running`.
- **Cách xử lý:** Mở ứng dụng Docker Desktop trên máy tính và đợi biểu tượng cá voi chuyển sang màu xanh (Running) rồi chạy lại lệnh.

### Lỗi 2: `Port already allocated` / Cổng mạng đã bị chiếm
- **Hiện tượng:** Docker báo lỗi `bind: address already in use` trên cổng 5435, 1026 hoặc 8026.
- **Cách xử lý:**
  1. Dùng PowerShell kiểm tra tiến trình chiếm cổng: `Get-NetTCPConnection -LocalPort 5435`.
  2. Đổi giá trị `POSTGRES_PORT`, `SMTP_PORT` hoặc `MAILPIT_WEB_PORT` trong file `.env` sang cổng trống tiếp theo (ví dụ: 5436, 1027, 8027).
  3. Cập nhật cổng tương ứng trong `DATABASE_URL` trong `.env`.
  4. Chạy lại `pnpm infra:up`.

### Lỗi 3: `DATABASE_URL is missing`
- **Hiện tượng:** Prisma báo lỗi thiếu biến môi trường `DATABASE_URL`.
- **Cách xử lý:** Đảm bảo file `.env` nằm tại thư mục gốc repository (cùng cấp với `package.json`). Lệnh migration chạy qua `dotenv-cli` sẽ tự động nạp file `.env` gốc này.

### Lỗi 4: `Prisma authentication failed for user`
- **Hiện tượng:** Kết nối PostgreSQL bị từ chối xác thực.
- **Cách xử lý:** Đảm bảo `POSTGRES_USER` và `POSTGRES_PASSWORD` trong `.env` khớp chính xác với thông tin trong chuỗi `DATABASE_URL`. Nếu vừa đổi mật khẩu trong `.env`, cần khởi động lại container PostgreSQL.

### Lỗi 5: `pnpm: command not found` / pnpm không được nhận diện
- **Hiện tượng:** Gõ `pnpm` trên terminal báo lệnh không tồn tại.
- **Cách xử lý:** Cài đặt pnpm qua npm: `npm install -g pnpm` hoặc qua Corepack: `corepack enable && corepack prepare pnpm@latest --activate`.

---

## 21. Quy trình Git, Nhánh & Pull Request

1. **Phân nhánh:**
   - Nhánh chính: `main` (Production-ready).
   - Nhánh tích hợp: `develop`.
   - Nhánh tính năng: `feature/<ma-yeu-cau>-<ten-tinh-nang>` (Ví dụ: `feature/fr01-auth-register`).
   - Nhánh sửa lỗi: `fix/<ten-loi>`.
2. **Commit message chuẩn Conventional Commits:**
   - `feat(...)`: Tính năng mới.
   - `fix(...)`: Sửa lỗi.
   - `docs(...)`: Cập nhật tài liệu.
   - `refactor(...)`: Tái cấu trúc mã nguồn.
   - `test(...)`: Bổ sung kiểm thử.
   - `chore(...)`: Tác vụ công cụ, CI, cấu hình.
3. **Quy tắc tạo Pull Request:**
   - Mở PR vào nhánh `develop`.
   - Điền đầy đủ thông tin theo mẫu `.github/pull_request_template.md`.
   - Bắt buộc vượt qua 100% các bước của CI Quality Gate trước khi merge.

---

## 22. Quy tắc Migration Database

1. Mọi thay đổi cấu trúc dữ liệu phải bắt đầu từ việc sửa `apps/api/prisma/schema.prisma`.
2. Tạo migration mới có tên rõ ràng:
   ```bash
   pnpm db:migrate
   ```
3. Tuyệt đối không sửa tay các file migration đã commit vào Git.
4. Trên môi trường CI hoặc Production, chỉ sử dụng:
   ```bash
   pnpm db:deploy
   ```

---

## 23. Quy định bảo mật tệp môi trường

- **TUYỆT ĐỐI KHÔNG** commit file `.env` lên GitHub hoặc chia sẻ công khai.
- Mọi biến môi trường mới bắt buộc phải khai báo giá trị mẫu không chứa bí mật vào `.env.example`.

---

## 24. Hướng dẫn chạy trên Windows CMD vs PowerShell

Hệ thống hỗ trợ cả Windows Command Prompt (CMD) và Windows PowerShell. Lưu ý sự khác nhau về cú pháp gán biến môi trường tạm thời:

| Thao tác | Windows PowerShell | Windows CMD |
|---|---|---|
| Sao chép `.env` | `Copy-Item .env.example .env` | `copy .env.example .env` |
| Đặt biến chạy CLI | `$env:ADMIN_PASSWORD="123"; pnpm admin:create ...` | `set ADMIN_PASSWORD=123 && pnpm admin:create ...` |
| Kiểm tra cổng | `Get-NetTCPConnection -LocalPort 5435` | `netstat -ano \| findstr :5435` |
| Liệt kê file | `Get-ChildItem` | `dir` |

---

## 25. Danh mục lệnh Script rút gọn

| Lệnh | Ý nghĩa |
|---|---|
| `pnpm dev` | Chạy đồng thời cả API và Web |
| `pnpm dev:api` | Chạy riêng NestJS backend với chế độ watch |
| `pnpm dev:web` | Chạy riêng Next.js frontend |
| `pnpm build` | Biên dịch toàn bộ monorepo |
| `pnpm lint` | Kiểm tra cú pháp mã nguồn |
| `pnpm typecheck` | Kiểm tra chặt chẽ kiểu dữ liệu TypeScript |
| `pnpm test` | Chạy unit tests |
| `pnpm test:e2e` | Chạy E2E tests trên database PostgreSQL |
| `pnpm db:generate` | Sinh Prisma client |
| `pnpm db:migrate` | Tạo và áp dụng database migration trong development |
| `pnpm db:deploy` | Áp dụng migration sẵn có vào database |
| `pnpm db:studio` | Mở trình duyệt xem dữ liệu Prisma Studio |
| `pnpm admin:create` | CLI tạo tài khoản Admin đầu tiên |
| `pnpm infra:up` | Khởi động PostgreSQL và Mailpit trong container cô lập |
| `pnpm infra:down` | Dừng các container của dự án CampusJob |
| `pnpm infra:ps` | Xem trạng thái các container của dự án CampusJob |
| `pnpm infra:logs` | Xem luồng log thời gian thực của container |
| `pnpm verify` | Chạy chuỗi kiểm tra chất lượng (typecheck, lint, test, build) |
