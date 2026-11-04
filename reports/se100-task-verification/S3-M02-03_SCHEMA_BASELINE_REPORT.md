# Báo cáo thực hiện và nghiệm thu Task S3-M02-03

- **Mã task:** `S3-M02-03`
- **Tên task:** Chốt một nguồn Prisma schema và đồng bộ Client/migration
- **Sprint:** Sprint 3
- **Độ ưu tiên:** P0
- **Người thực hiện:** Nguyễn Thị Ngọc Huyền
- **Ngày thực hiện:** 2026-11-04
- **Hợp đồng liên quan:** C-03, C-04, C-05
- **WBS liên quan:** W2-DB-01, W2-DB-02, W2-DB-03 và chuỗi migration hiện hữu

---

## 1. Mục tiêu và Tiêu chí nghiệm thu (Acceptance Criteria)

| Tiêu chí | Mô tả yêu cầu | Trạng thái |
|---|---|---|
| **AC-01** | Xác nhận duy nhất một nguồn chân lý (Single Source of Truth) cho schema: `apps/api/prisma/schema.prisma`. | **ĐẠT (PASS)** |
| **AC-02** | Đối chiếu đầy đủ các model: `Skill`, `StudentSkill`, `FileAsset`, `Cv.fileAssetId`, `CompanyVerificationDocument` và các model M05. | **ĐẠT (PASS)** |
| **AC-03** | Chạy `prisma validate` và `prisma generate` từ đúng schema, không sửa thủ công mã nguồn trong generated client. | **ĐẠT (PASS)** |
| **AC-04** | Kiểm tra chuỗi migration chạy thành công 100% trên cơ sở dữ liệu rỗng (`campusjob_clean_test`), không xóa volume hay ảnh hưởng dữ liệu đang có. | **ĐẠT (PASS)** |
| **AC-05** | Quan hệ, enum, unique index khớp hoàn toàn với code repositories; `pnpm typecheck` toàn monorepo vượt qua không lỗi. | **ĐẠT (PASS)** |

---

## 2. Kết quả kiểm tra và đối chiếu chi tiết

### 2.1 Xác nhận nguồn Schema & cấu hình dự án
- **Đường dẫn duy nhất:** `apps/api/prisma/schema.prisma`.
- **Prisma Client consumer:** `apps/api/src/shared/database/prisma.service.ts` kế thừa trực tiếp từ `@prisma/client`.
- **Cấu hình script tại root (`package.json`):**
  - `db:validate`: `dotenv -e .env -- pnpm --filter @campusjob/api exec prisma validate --schema prisma/schema.prisma`
  - `db:generate`: `pnpm --filter @campusjob/api exec prisma generate --schema prisma/schema.prisma`
  - `db:migrate`: `dotenv -e .env -- pnpm --filter @campusjob/api exec prisma migrate dev --schema prisma/schema.prisma`
  - `db:deploy`: `dotenv -e .env -- pnpm --filter @campusjob/api exec prisma migrate deploy --schema prisma/schema.prisma`
- Không có sự phân mảnh hay file `schema.prisma` nào khác trong toàn bộ repository.

### 2.2 Đối chiếu Models, Ràng buộc và Contracts

1. **Skill & StudentSkill (`W2-DB-01`):**
   - Model `Skill`: chứa `id`, `name`, `normalizedName` (đánh index và `@unique`), `studentSkills StudentSkill[]`.
   - Model `StudentSkill`: chứa `studentProfileId`, `skillId`, `@unique([studentProfileId, skillId])`, khóa ngoại onDelete `Cascade`.
   - Khớp với DTO: `SkillDto`, `StudentSkillDto` trong `packages/contracts/src/index.ts`.

2. **FileAsset & Cv (`W2-DB-02` / `W2-DO-01`):**
   - `enum FileAssetStatus`: `PENDING_UPLOAD`, `PERMANENT`, `PENDING_DELETION`.
   - Model `FileAsset`: chứa `storageKey` (`@unique`), `ownerUserId` (FK onDelete `Cascade`), liên kết `cv Cv?`, `companyVerificationDocuments CompanyVerificationDocument[]`.
   - Model `Cv`: `fileAssetId String? @unique`, quan hệ 1-1 với `FileAsset` (`onDelete: SetNull`).
   - Khớp với DTO: `FileAssetStatus`, `FileAssetDto`, `CvSnapshotDto.fileAssetId`.

3. **CompanyVerificationDocument (`W2-DB-03`):**
   - Model `CompanyVerificationDocument`: `verificationId`, `fileAssetId`, `documentType DocumentType @default(BUSINESS_LICENSE)`, `@unique([verificationId, fileAssetId])`.
   - Liên kết `FileAsset` với quy tắc an toàn `onDelete: Restrict`.

4. **Các Model M05 (Trust, Moderation, Sanctions, Reviews):**
   - **Moderation (C-16):** `ModerationItem`, `ModerationDecision` với targetType không FK cứng để bảo toàn ranh giới phân hệ.
   - **Violation Report (C-17):** `ViolationReport`, `ViolationEvidence`.
   - **Sanction (C-18):** `Sanction`, `SanctionEvent`.
   - **Review (C-19):** `Review`, `ReviewReply`.
   - **Notification (C-20):** `Notification`.

---

## 3. Lịch sử thực thi lệnh và kết quả kiểm chứng

### 3.1 Validate Schema
- **Lệnh:** `pnpm db:validate`
- **Kết quả:**
  ```text
  The schema at prisma\schema.prisma is valid 🚀
  ```

### 3.2 Sinh Prisma Client (Generate)
- **Lệnh:** `pnpm db:generate`
- **Kết quả:**
  ```text
  ✔ Generated Prisma Client (v6.19.3) to .\..\..\node_modules\.pnpm\@prisma+client@6.19.3_prism_...
  ```
  *(Sinh trực tiếp từ schema, không can thiệp thủ công mã nguồn).*

### 3.3 Kiểm tra Migration trên Database rỗng độc lập
- **Tạo DB test cô lập:** `CREATE DATABASE campusjob_clean_test;` trên container PostgreSQL 16.
- **Lệnh thực thi:** `prisma migrate deploy --schema prisma/schema.prisma` với `DATABASE_URL` trỏ vào `campusjob_clean_test`.
- **Kết quả:** Toàn bộ 17 migrations được áp dụng thành công theo đúng thứ tự:
  1. `20260930174054_init_auth_baseline`
  2. `20261012170000_m05_add_notification`
  3. `20261012172613_add_student_profile`
  4. `20261014025500_add_cv_management`
  5. `20261014090000_m05_add_moderation`
  6. `20261014095000_add_m04_application_contract`
  7. `20261014100000_add_m04_interview`
  8. `20261015100000_m05_add_violation_report`
  9. `20261015110000_m05_add_review`
  10. `20261015120000_m05_add_sanction`
  11. `20261016100000_add_file_asset_and_cv_integrity`
  12. `20261016110000_normalize_student_skills`
  13. `20261016120000_add_company_and_verification`
  14. `20261025171500_add_job_posting_and_branch_coordinates`
  15. `20261025210000_add_job_rejection_and_moderation_hide`
  16. `20261031120000_add_job_view_and_expiry_reminder_logs`
  17. `20261102090000_m04_production_events_and_close_suggestion`
  ```text
  All migrations have been successfully applied.
  ```
- **Dọn dẹp môi trường:** Đã thực hiện `DROP DATABASE campusjob_clean_test;` ngay sau khi nghiệm thu, không làm ảnh hưởng đến dữ liệu dev hay docker volume.

### 3.4 Kiểm định Typecheck
- **Lệnh:** `pnpm typecheck`
- **Kết quả:**
  - `packages/contracts`: Done (0 lỗi)
  - `apps/web`: Done (0 lỗi)
  - `apps/api`: Done (0 lỗi)
  - Exit code: 0

---

## 4. Kết luận nghiệm thu
Task **`S3-M02-03`** đã hoàn thành các tiêu chí kỹ thuật đề ra:
- Nguồn schema đã được chốt và bảo đảm tính duy nhất.
- Các model và ràng buộc khóa/unique/index đã được đối chiếu chuẩn xác.
- Prisma Client được sinh đồng bộ và sạch sẽ.
- Tính toàn vẹn của chuỗi migration được chứng minh trên database rỗng.
- Toàn bộ codebase monorepo typecheck xanh tuyệt đối.
