# CAMPUSJOB — TÀI LIỆU CHUẨN HÓA SCHEMA BASELINE (SCHEMA BASELINE SPECIFICATION)

> **Mã công việc:** `S3-M02-03` | **Sprint:** 3 | **Task cha:** `S3-M02-01`  
> **Người thực hiện:** Nguyễn Thị Ngọc Huyền  
> **Hợp đồng liên quan:** C-03 (CV Snapshot), C-04 (Privacy), C-05 (Ownership)  
> **Căn cứ kỹ thuật:** W2-DB-01 (Skill Normalization), W2-DB-02 (FileAsset Lifecycle), W2-DB-03 (Company Verification Document)

---

## 1. Nguồn chân lý duy nhất (Single Source of Truth)

Toàn bộ hệ thống CampusJob sử dụng **duy nhất một schema Prisma** tại đường dẫn:
```text
apps/api/prisma/schema.prisma
```

### 1.1 Kiểm soát script và cấu hình dự án
Tất cả các lệnh tương tác DB tại file root `package.json` đều được chuẩn hóa trỏ trực tiếp vào schema này:
* `pnpm db:validate`: `dotenv -e .env -- pnpm --filter @campusjob/api exec prisma validate --schema prisma/schema.prisma`
* `pnpm db:generate`: `pnpm --filter @campusjob/api exec prisma generate --schema prisma/schema.prisma`
* `pnpm db:migrate`: `dotenv -e .env -- pnpm --filter @campusjob/api exec prisma migrate dev --schema prisma/schema.prisma`
* `pnpm db:deploy`: `dotenv -e .env -- pnpm --filter @campusjob/api exec prisma migrate deploy --schema prisma/schema.prisma`

### 1.2 Nhận diện & Xử lý rủi ro sai lệch Client (Root Cause of TS Errors)
- **Nguyên nhân cốt lõi:** Trước đây, trong quá trình phát triển phân hệ M02 và M05, nhiều lỗi TypeScript (`Property 'skill' does not exist on type 'TransactionClient'`, `Property 'studentSkill' does not exist...`) phát sinh do lập trình viên chỉ cập nhật `schema.prisma` nhưng **chưa chạy `prisma generate`**, hoặc do chạy lệnh không truyền đúng cờ `--schema`, dẫn đến `@prisma/client` trong `node_modules` không phản ánh các model mới. Điều này buộc lập trình viên phải ép kiểu tạm thời `(tx as any).skill`.
- **Nguyên tắc bất biến (Invariant):**
  1. Tuyệt đối **không sửa thủ công** code bên trong `node_modules/@prisma/client`.
  2. Tuyệt đối **không tự ý thêm/xóa model** chỉ dựa trên lỗi TypeScript runtime; bắt buộc đối chiếu với chuỗi migration SQL và hợp đồng liên phân hệ trước.
  3. Mọi thay đổi schema bắt buộc đi qua chu trình 3 bước chuẩn:
     $$\text{Validate Schema} \longrightarrow \text{Generate Prisma Client} \longrightarrow \text{Verify Typecheck}$$

---

## 2. Đối chiếu chi tiết Models, Ràng buộc và Contracts

### 2.1 Chuẩn hóa Kỹ năng (`W2-DB-01` — `Skill` & `StudentSkill`)
Chuyển đổi từ mảng text phi chuẩn (`StudentProfile.skills: String[]`) sang quan hệ Many-to-Many chuẩn hóa thông qua bảng trung gian `StudentSkill`:

```prisma
model Skill {
  id             String         @id @default(uuid())
  name           String
  normalizedName String         @unique
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  studentSkills  StudentSkill[]

  @@index([normalizedName])
}

model StudentSkill {
  id               String         @id @default(uuid())
  studentProfileId String
  skillId          String
  createdAt        DateTime       @default(now())

  studentProfile   StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
  skill            Skill          @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@unique([studentProfileId, skillId])
  @@index([studentProfileId])
  @@index([skillId])
}
```

* **Quy chuẩn đối chiếu:**
  * Khóa tự nhiên duy nhất: `normalizedName` (lowercase, trimmed) bảo đảm không trùng lặp (ví dụ: `Node.js` vs `nodejs`).
  * Khóa duy nhất phức hợp: `@@unique([studentProfileId, skillId])` ngăn trùng lặp kỹ năng cho cùng một sinh viên.
  * Hành vi xóa: `onDelete: Cascade` khi xóa `StudentProfile` hoặc xóa `Skill`.
  * Khớp hoàn toàn với `PrismaStudentProfileRepository` (đã gỡ bỏ ép kiểu `as any`, truy vấn chuẩn qua `include: { studentSkills: { include: { skill: true } } }`).

---

### 2.2 Vòng đời Tệp tin & Liên kết CV (`W2-DB-02` — `FileAsset` & `Cv.fileAssetId`)

```prisma
enum FileAssetStatus {
  PENDING_UPLOAD
  PERMANENT
  PENDING_DELETION
}

model FileAsset {
  id                            String          @id @default(uuid())
  ownerUserId                   String
  ownerUser                     User            @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  originalName                  String?
  mimeType                      String
  sizeBytes                     Int
  checksumSha256                String
  storageKey                    String          @unique
  status                        FileAssetStatus @default(PERMANENT)
  uploadedAt                    DateTime        @default(now())
  updatedAt                     DateTime        @updatedAt

  cv                            Cv?
  companyVerificationDocuments  CompanyVerificationDocument[]

  @@index([ownerUserId])
}

model Cv {
  id               String         @id @default(uuid())
  studentProfileId String
  studentProfile   StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
  title            String
  summary          String?
  isDefault        Boolean        @default(false)
  fileUrl          String?
  fileAssetId      String?        @unique
  fileAsset        FileAsset?     @relation(fields: [fileAssetId], references: [id], onDelete: SetNull)
  skills           String[]       @default([])
  educations       Json           @default("[]")
  experiences      Json           @default("[]")
  projects         Json           @default("[]")
  certifications   Json           @default("[]")
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([studentProfileId])
  @@index([studentProfileId, isDefault])
}
```

* **Quy chuẩn đối chiếu:**
  * Ràng buộc 1-1 duy nhất: `fileAssetId String? @unique` trên `Cv`. Một file CV chỉ thuộc về duy nhất một bản ghi CV tại một thời điểm.
  * Tính toàn vẹn khi xóa CV: `onDelete: SetNull` bảo đảm nếu bản ghi CV bị xóa thì bản ghi `FileAsset` không bị xóa dây chuyền đột ngột; việc thu hồi file vật lý được điều phối qua tiến trình vòng đời riêng (`PENDING_DELETION`).
  * Khóa dòng bảo vệ tranh chấp (Concurrency Lock): `PrismaCvRepository` thực hiện khóa dòng bằng `SELECT 1 FROM "FileAsset" WHERE "id" = ... FOR UPDATE` trước khi chuyển `status` sang `PERMANENT`.
  * Hợp đồng C-03 & C-05: `CvSnapshotDto.fileAssetId` lưu trữ bất biến khóa tệp tại thời điểm nộp đơn; `isCvInUse(cvId)` kiểm tra không cho phép xóa CV nếu có hồ sơ ứng tuyển đang hoạt động (`notIn: ['ACCEPTED', 'REJECTED', 'WITHDRAWN']`).

---

### 2.3 Hồ sơ Pháp lý & Tài liệu Xác thực Doanh nghiệp (`W2-DB-03` — `CompanyVerificationDocument`)

```prisma
model CompanyVerificationDocument {
  id             String              @id @default(uuid())
  verificationId String
  fileAssetId    String
  documentType   DocumentType        @default(BUSINESS_LICENSE)
  createdAt      DateTime            @default(now())

  verification   CompanyVerification @relation(fields: [verificationId], references: [id], onDelete: Cascade)
  fileAsset      FileAsset           @relation(fields: [fileAssetId], references: [id], onDelete: Restrict)

  @@unique([verificationId, fileAssetId])
  @@index([verificationId])
  @@index([fileAssetId])
}
```

* **Quy chuẩn đối chiếu:**
  * Ràng buộc kép: `@@unique([verificationId, fileAssetId])` ngăn đính kèm cùng một file nhiều lần vào một yêu cầu xác minh.
  * Bảo vệ tài liệu: `onDelete: Restrict` đối với `FileAsset` — không thể xóa `FileAsset` nếu đang được liên kết làm chứng từ xác thực doanh nghiệp.
  * Khớp với `PrismaCompanyVerificationRepository`: mapping kèm thông tin chi tiết metadata của `fileAsset` (`mimeType`, `sizeBytes`, `uploadedAt`).

---

### 2.4 Mô hình Phân hệ Kiểm duyệt & Tin cậy (M05 Models)

Các model M05 tuân thủ nguyên tắc thiết kế ranh giới lỏng (Loose Coupling): Các trường `targetId`, `submitterId`, `assigneeId`, `reviewerId` là dạng chuỗi (`String`) không tạo Foreign Key vật lý sang bảng của các module khác để tránh phụ thuộc vòng giữa các domain:

| Model | Hợp đồng | Vai trò nghiệp vụ | Các ràng buộc & Chỉ mục chính |
|---|---|---|---|
| `ModerationItem` | C-16 | Quản lý hàng đợi kiểm duyệt tin tuyển dụng, bài đánh giá, báo cáo | `@@unique([targetType, targetId, round])`, `@@index([status, targetType, enqueuedAt])` |
| `ModerationDecision` | C-16 | Lịch sử quyết định của kiểm duyệt viên | `itemId` FK cascade sang `ModerationItem`, `@@index([itemId])`, `@@index([targetSyncedAt])` |
| `ViolationReport` | C-17 | Báo cáo vi phạm từ người dùng | `openKey String? @unique` ràng buộc chống báo cáo trùng lặp khi báo cáo cũ chưa xử lý |
| `ViolationEvidence` | C-17 | Bằng chứng đính kèm báo cáo vi phạm | `reportId` FK cascade sang `ViolationReport` |
| `Sanction` | C-18 | Chế tài xử phạt tài khoản / doanh nghiệp | `userId String`, `status SanctionStatus`, `@@index([userId, status])` |
| `SanctionEvent` | C-18 | Lịch sử biến động chế tài | `sanctionId` FK cascade sang `Sanction` |
| `Review` | C-19 | Đánh giá doanh nghiệp từ trải nghiệm thực tế | `applicationId String @unique` (mỗi lượt ứng tuyển chỉ được đánh giá 1 lần) |
| `ReviewReply` | C-19 | Phản hồi từ doanh nghiệp | `reviewId String @unique` (mỗi đánh giá chỉ có 1 phản hồi chính thức từ cty) |
| `Notification` | C-20 | Thông báo hệ thống gửi người dùng | `userId String`, `isRead Boolean`, `@@index([userId, isRead])` |

---

## 3. Ma trận Đối soát Quan hệ và Kiểu dữ liệu

| Phân hệ / Model | Model cha / Model liên kết | Quan hệ | Khóa ngoại (FK) | Hành vi onDelete | Khớp Code Repo |
|---|---|---|---|---|---|
| `StudentProfile` | `User` | 1 - 1 | `userId` | `Cascade` | `PrismaStudentProfileRepository` |
| `StudentSkill` | `StudentProfile` | N - 1 | `studentProfileId` | `Cascade` | `PrismaStudentProfileRepository` |
| `StudentSkill` | `Skill` | N - 1 | `skillId` | `Cascade` | `PrismaStudentProfileRepository` |
| `Cv` | `StudentProfile` | N - 1 | `studentProfileId` | `Cascade` | `PrismaCvRepository` |
| `Cv` | `FileAsset` | 1 - 1 (Optional) | `fileAssetId` | `SetNull` | `PrismaCvRepository` |
| `FileAsset` | `User` | N - 1 | `ownerUserId` | `Cascade` | `DownloadCvFileUseCase` |
| `CompanyVerification` | `Company` | N - 1 | `companyId` | `Cascade` | `PrismaCompanyVerificationRepository` |
| `CompanyVerificationDocument` | `CompanyVerification` | N - 1 | `verificationId` | `Cascade` | `PrismaCompanyVerificationRepository` |
| `CompanyVerificationDocument` | `FileAsset` | N - 1 | `fileAssetId` | `Restrict` | `PrismaCompanyVerificationRepository` |
| `Application` | `JobPosting` | N - 1 | `jobId` | `Restrict` | `PrismaM04Repository` |
| `M04EventOutbox` | Độc lập | Transactional Outbox | None | None | `M04EventDispatcher` |

---

## 4. Kết luận
Schema baseline tại `apps/api/prisma/schema.prisma` đã đạt trạng thái ổn định (Frozen/Baseline), đáp ứng trọn vẹn mọi yêu cầu hợp đồng C-03, C-04, C-05 và hoàn toàn đồng bộ với mã nguồn tầng repository của toàn bộ dự án.
