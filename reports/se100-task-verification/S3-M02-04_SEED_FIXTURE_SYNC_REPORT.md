# Báo cáo thực hiện và nghiệm thu Task S3-M02-04

- **Mã task:** `S3-M02-04`
- **Tên task:** Đồng bộ seed và test fixtures với Skill/StudentSkill chuẩn hóa
- **Sprint:** Sprint 3
- **Độ ưu tiên:** P0
- **Người thực hiện:** Nguyễn Thị Ngọc Huyền
- **Ngày thực hiện:** 2026-11-04
- **Hợp đồng liên quan:** C-03 (CV Snapshot), C-04 (Privacy/Scoping)
- **Task cha / Căn cứ:** `S3-M02-03`

---

## 1. Mục tiêu và Tiêu chí nghiệm thu (Acceptance Criteria)

| Tiêu chí | Mô tả yêu cầu | Trạng thái |
|---|---|---|
| **AC-01** | Bỏ `StudentProfile.skills` khỏi các lệnh `create` / `update` trong seed và test fixtures. Không còn lỗi runtime/type `'skills' does not exist in StudentProfile`. | **ĐẠT (PASS)** |
| **AC-02** | Tạo / tái sử dụng `Skill` (qua `normalizedName @unique`) và liên kết `StudentSkill` (qua khóa duy nhất phức hợp `@@unique([studentProfileId, skillId])`). Chạy lặp lại nhiều lần không tạo trùng. | **ĐẠT (PASS)** |
| **AC-03** | Toàn bộ fixtures theo schema hiện hành; các hook cleanup (`beforeAll` / `afterAll`) dọn dẹp sạch `studentSkill` trước khi xóa `studentProfile`. | **ĐẠT (PASS)** |
| **AC-04** | Bộ test hồi quy (`seed-student-skills.regression.spec.ts`) và typecheck monorepo vượt qua 100%. | **ĐẠT (PASS)** |

---

## 2. Chi tiết các tệp mã nguồn và Fixtures đã xử lý

### 2.1 Cập nhật kịch bản Seed (`apps/api/src/cli/seed-student.ts`)
- **Tự động tải biến môi trường:** Bổ sung `import 'dotenv/config'` để hỗ trợ chạy độc lập từ CLI hoặc qua npm script.
- **Tách biệt dữ liệu sinh viên:** Payload `prisma.studentProfile.create` chỉ chứa các trường thông tin học vấn/tiểu sử (`userId`, `university`, `major`, `graduationYear`, `bio`), không chứa mảng `skills`.
- **Idempotent Skills Upsert:**
  - `Skill.upsert`: sử dụng `where: { normalizedName }` để tái sử dụng kỹ năng chuẩn hóa nếu đã tồn tại.
  - `StudentSkill.upsert`: sử dụng `where: { studentProfileId_skillId: { studentProfileId, skillId } }` bảo đảm không phát sinh lỗi khóa trùng hay nhân đôi liên kết khi chạy nhiều lần.

### 2.2 Đồng bộ kịch bản chạy tại `package.json`
- Bổ sung lệnh tiện ích tại file root `package.json`:
  ```json
  "student:seed": "dotenv -e .env -- pnpm --filter @campusjob/api student:seed"
  ```
  tương đồng với lệnh `admin:create`.

### 2.3 Bảo đảm tính toàn vẹn dọn dẹp dữ liệu trong Test Fixtures
Đã rà soát và bổ sung câu lệnh xóa liên kết `studentSkill` trước khi xóa `studentProfile` trong các bộ test tích hợp và E2E:
- `apps/api/test/m02-integration.e2e-spec.ts`: Đã có `prisma.studentSkill.deleteMany` và logic upsert chuẩn hóa.
- `apps/api/test/w2-concurrency-and-upload.e2e-spec.ts`: Bổ sung `await prisma.studentSkill.deleteMany({ where: { studentProfileId: testStudentProfile.id } })`.
- `apps/api/test/account-integration.e2e-spec.ts`: Bổ sung `await prisma.studentSkill.deleteMany({ where: { studentProfileId: { in: profileIds } } })`.
- `apps/api/test/cross-module-auth.e2e-spec.ts`: Bổ sung `await prisma.studentSkill.deleteMany({ where: { studentProfileId: { in: profileIds } } })`.

### 2.4 Xây dựng bài kiểm thử hồi quy chuyên biệt
Tạo file kiểm thử hồi quy:
`apps/api/src/modules/students/application/seed-student-skills.regression.spec.ts`
- Xác minh type payload không còn trường `skills`.
- Mô phỏng chạy vòng lặp seed 3 lần liên tiếp với các biến thể kỹ năng (viết hoa/thường, khoảng trắng biên) và xác nhận số lượng kỹ năng / liên kết không bị nhân bản.
- Xác nhận thứ tự dọn dẹp dữ liệu an toàn.

---

## 3. Lịch sử thực thi lệnh và kết quả kiểm thử

### 3.1 Unit & Regression Test
- **Lệnh:**
  ```bash
  pnpm --filter @campusjob/api exec jest src/modules/students/application/seed-student-skills.regression.spec.ts
  ```
- **Kết quả:**
  ```text
  PASS src/modules/students/application/seed-student-skills.regression.spec.ts
    S3-M02-04 Regression: Seed & Fixture Skill Normalization
      √ AC-01: Không còn trường skills trong StudentProfile create/update payload (13 ms)
      √ AC-02: Idempotent Seed - chạy nhiều lần không tạo skill hay liên kết trùng (3 ms)
      √ AC-03: Fixture Cleanup Integrity (2 ms)

  Test Suites: 1 passed, 1 total
  Tests:       3 passed, 3 total
  ```

- **Kiểm tra Repository Spec:**
  ```bash
  pnpm --filter @campusjob/api exec jest src/modules/students/infrastructure/persistence/prisma-student-profile.repository.spec.ts
  ```
- **Kết quả:**
  ```text
  PASS src/modules/students/infrastructure/persistence/prisma-student-profile.repository.spec.ts
  Tests: 4 passed, 4 total
  ```

### 3.2 Kiểm định Typecheck Monorepo
- **Lệnh:**
  ```bash
  pnpm typecheck
  ```
- **Kết quả:**
  - `packages/contracts`: PASS (0 lỗi)
  - `apps/web`: PASS (0 lỗi)
  - `apps/api`: PASS (0 lỗi)

---

## 4. Kết luận nghiệm thu
Task **`S3-M02-04`** đã hoàn thành các tiêu chí kỹ thuật đề ra:
- Toàn bộ seed scripts và fixtures đã loại bỏ triệt để trường legacy `StudentProfile.skills`.
- Cơ chế tạo và liên kết kỹ năng đạt tính lũy đẳng (idempotent), cho phép tái sử dụng an toàn khi chạy lại nhiều lần.
- Bộ test hồi quy và quy trình kiểm thử kiểu dữ liệu tĩnh đạt chuẩn 100%.
