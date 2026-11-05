# BÁO CÁO THẨM ĐỊNH MIGRATION TRÊN DATABASE RỖNG (MIGRATION REPORT)

> **Mã công việc:** `S3-M02-03` | **Sprint:** 3  
> **Người thực hiện:** Nguyễn Thị Ngọc Huyền  
> **Tiêu chuẩn nghiệm thu:** Migration chạy 100% thành công từ Database rỗng; không lỗi foreign key/constraint; không xóa volume/data dev hiện có.

---

## 1. Phương pháp & Môi trường kiểm thử

* **Môi trường Database:** PostgreSQL 16 Alpine cô lập trên Docker (chạy song song, không làm gián đoạn database `campusjob` chính).
* **Quy trình kiểm thử:**
  1. Khởi tạo một cơ sở dữ liệu hoàn toàn mới và rỗng:
     ```sql
     CREATE DATABASE campusjob_clean_test;
     ```
  2. Cấu hình biến môi trường `DATABASE_URL` trỏ trực tiếp vào database rỗng:
     ```text
     DATABASE_URL=postgresql://campusjob:campusjob_dev@localhost:5435/campusjob_clean_test?schema=public
     ```
  3. Áp dụng toàn bộ lịch sử migrations bằng Prisma CLI:
     ```bash
     pnpm --filter @campusjob/api exec prisma migrate deploy --schema prisma/schema.prisma
     ```
  4. Xác nhận trạng thái của từng migration và dọn dẹp môi trường sau kiểm thử.

---

## 2. Kết quả thực thi Migration tuần tự (Audit Trail)

Toàn bộ **17 migrations** đã được áp dụng thành công tuần tự theo thứ tự thời gian:

```text
Datasource "db": PostgreSQL database "campusjob_clean_test", schema "public" at "localhost:5435"

17 migrations found in prisma/migrations

Applying migration `20260930174054_init_auth_baseline`
Applying migration `20261012170000_m05_add_notification`
Applying migration `20261012172613_add_student_profile`
Applying migration `20261014025500_add_cv_management`
Applying migration `20261014090000_m05_add_moderation`
Applying migration `20261014095000_add_m04_application_contract`
Applying migration `20261014100000_add_m04_interview`
Applying migration `20261015100000_m05_add_violation_report`
Applying migration `20261015110000_m05_add_review`
Applying migration `20261015120000_m05_add_sanction`
Applying migration `20261016100000_add_file_asset_and_cv_integrity`
Applying migration `20261016110000_normalize_student_skills`
Applying migration `20261016120000_add_company_and_verification`
Applying migration `20261025171500_add_job_posting_and_branch_coordinates`
Applying migration `20261025210000_add_job_rejection_and_moderation_hide`
Applying migration `20261031120000_add_job_view_and_expiry_reminder_logs`
Applying migration `20261102090000_m04_production_events_and_close_suggestion`

All migrations have been successfully applied.
```

---

## 3. Đánh giá tính toàn vẹn của các Migration trọng yếu

| Thứ tự | Tên Migration | Phân hệ / WBS | Đánh giá tính toàn vẹn trên DB rỗng |
|---|---|---|---|
| **01** | `20260930174054_init_auth_baseline` | M01 Baseline | Tạo bảng `User`, `AuthSession`, `AuditLog`, enum `UserRole`, `UserStatus`. Khởi tạo index an toàn. |
| **02–04**| `20261012...` – `20261014...` | M02 Profile & CV | Tạo bảng `StudentProfile`, `Cv` ban đầu với `userId` FK cascade. |
| **05–10**| `20261014...` – `20261015...` | M04 & M05 Baseline | Tạo các bảng ứng tuyển (`Application`, `Interview`) và bảng kiểm duyệt/chế tài M05 mà không bị lỗi phụ thuộc vòng. |
| **11** | `20261016100000_add_file_asset_and_cv_integrity` | **W2-DB-02** | Thêm bảng `FileAsset` và cột `fileAssetId` trên `Cv`. Ràng buộc 1-1 unique và FK `onDelete: SetNull` chạy mượt mà. |
| **12** | `20261016110000_normalize_student_skills` | **W2-DB-01** | Tạo bảng `Skill`, `StudentSkill` chuẩn hóa, unique index `normalizedName` và composite unique `(studentProfileId, skillId)`. Xóa bỏ an toàn cột legacy. |
| **13** | `20261016120000_add_company_and_verification` | **W2-DB-03** | Tạo các bảng `Company`, `CompanyBranch`, `CompanyVerification`, `CompanyVerificationDocument` liên kết `FileAsset` (`onDelete: Restrict`). |
| **14–16**| `20261025...` – `20261031...` | M03 Jobs & Metrics | Bổ sung `JobPosting`, `SavedJob`, `JobViewLog`, `JobExpiryReminderLog` và hỗ trợ toạ độ chi nhánh. |
| **17** | `20261102090000_m04_production_events...` | M04 Integration | Bổ sung bảng outbox `M04EventOutbox` và `JobCloseSuggestion` bảo đảm tính bất biến và idempotent. |

---

## 4. Dọn dẹp & Bảo toàn dữ liệu (Safety Guarantees)

1. **Bảo toàn dữ liệu dev:** Toàn bộ dữ liệu tại cơ sở dữ liệu `campusjob` và Docker volume `campusjob-official_postgres_data` không bị tác động, không bị reset.
2. **Thu hồi tài nguyên:** Cơ sở dữ liệu thử nghiệm `campusjob_clean_test` đã được drop hoàn toàn bằng lệnh:
   ```sql
   DROP DATABASE campusjob_clean_test;
   ```
3. **Mã nguồn Generated Client:** Được sinh tự động bằng `pnpm db:generate`, không có bất kỳ chỉnh sửa thủ công nào trong thư mục `node_modules/@prisma/client`.

---

## 5. Kết luận nghiệm thu
Chuỗi migration của dự án CampusJob là **100% tái tạo được (reproducible)** từ một cơ sở dữ liệu trắng, bảo đảm hệ thống có thể triển khai mới trên bất kỳ môi trường nào (CI/CD, staging, production) mà không gặp lỗi thứ tự phụ thuộc hay xung đột ràng buộc.
