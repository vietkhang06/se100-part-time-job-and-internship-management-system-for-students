# Báo cáo thực hiện và nghiệm thu Task S4-M02-01

- **Mã task:** `S4-M02-01`
- **Tên task:** Đồng bộ StudentProfile fields và ánh xạ kỹ năng chuẩn hóa sang DTO
- **Sprint:** Sprint 4
- **Độ ưu tiên:** P1
- **Người thực hiện:** Gia Khang
- **Ngày thực hiện:** 2026-11-05
- **Hợp đồng liên quan:** C-03 (CV Snapshot & Student Profile Contract), C-04 (Privacy/Scoping)
- **Task cha / Căn cứ:** `S3-M02-03`, `StudentProfileDto`, danh mục `FR-05`/`FR-06`

---

## 1. Mục tiêu và Tiêu chí nghiệm thu (Acceptance Criteria)

| Tiêu chí | Mô tả yêu cầu | Trạng thái |
|---|---|:---:|
| **AC-01** | **GET profile trả DTO theo contract:** Endpoint `GET /api/v1/students/profile` trả về đầy đủ 16 trường theo `StudentProfileDto` (`id`, `userId`, `fullName`, `email`, `phone`, `university`, `major`, `graduationYear`, `jobSeekingStatus`, `bio`, `skills`, `avatarUrl`, `isCampusVerified`, `campusEmail`, `createdAt`, `updatedAt`). | **ĐẠT (PASS)** |
| **AC-02** | **Skill list lấy từ StudentSkill:** Danh sách kỹ năng trả về trên DTO được trích xuất từ bảng quan hệ chuẩn hóa `StudentSkill` (`include: { studentSkills: { include: { skill: true } } }`), không query trường mảng cũ. | **ĐẠT (PASS)** |
| **AC-03** | **Update không truyền relation tùy tiện:** Endpoint `PATCH /api/v1/students/profile` chỉ nhận mảng kỹ năng phẳng (`skills?: string[]`), không cho phép client truyền relation object (`studentSkills`) hay ID quan hệ tùy tiện. | **ĐẠT (PASS)** |
| **AC-04** | **Field không có trong scope không tự lưu hoặc giả dữ liệu:** Các trường chưa có persistence (`avatarUrl`, `isCampusVerified`, `campusEmail`) được trả về mặc định an toàn (`null` / `false`), không tự thêm cột database hoặc tạo mock giả lập dữ liệu khi chưa có yêu cầu FR/SRS được xác nhận. | **ĐẠT (PASS)** |
| **AC-05** | **Bảo toàn quyền sở hữu (Ownership):** Danh tính sinh viên được trích xuất 100% từ JWT Token (`AuthContext.id`), chống hoàn toàn IDOR; client không thể giả mạo hoặc cập nhật hồ sơ người khác qua request body. | **ĐẠT (PASS)** |

---

## 2. Quyết định kiến trúc chính thức (ADR-015)

Đã ghi nhận quyết định kiến trúc tại `docs/decisions/DECISION_LOG.md`:

> **ADR-015:** Đồng bộ `StudentProfileDto` (C-03) và schema Prisma:
> - Ánh xạ danh sách kỹ năng chuẩn hóa: `StudentSkill` (n-n với bảng `Skill`) được mapper `toDomain` trích xuất thành mảng chuỗi phẳng `skills: string[]` trên DTO.
> - Các trường `avatarUrl`, `campusEmail`, `isCampusVerified` chưa có trường lưu trữ (persistence fields) trong schema hiện hành:
>   - `avatarUrl`: Trả `null` theo contract (chưa có yêu cầu SRS về avatar sinh viên; CV dùng `FileAsset` riêng).
>   - `campusEmail` & `isCampusVerified`: Thuộc phân rã của FR-06 (*Xác thực email trường*). Duy trì trả `null` / `false` mặc định theo đúng contract C-03.
>   - Tuyệt đối không tự ý thêm migration/cột giả hoặc inject mock data vào cơ sở dữ liệu khi chưa có đặc tả chính thức.

---

## 3. Chi tiết thực thi và kiểm thử

### 3.1 Unit Test chuyên biệt
- **Tệp:** `apps/api/src/modules/students/application/use-cases/student-profile-dto-mapping.spec.ts`
- **Kết quả:** 4/4 test cases passed.
  - `should return StudentProfileDto matching all 16 contract fields`: PASS
  - `should maintain safe defaults for non-persisted fields`: PASS
  - `should map empty skills array cleanly when entity has no skills`: PASS
  - `should pass only domain update fields to repository and map updated DTO`: PASS

### 3.2 E2E Test chuyên biệt
- **Tệp:** `apps/api/test/student-profile-dto-mapping.e2e-spec.ts`
- **Kết quả:** 7/7 test cases passed trên cơ sở dữ liệu thật:
  - `S4-M02-01-E2E-01: should return full StudentProfileDto matching all 16 contract fields`: PASS
  - `S4-M02-01-E2E-02: should return empty skills array when student has no skills linked`: PASS
  - `S4-M02-01-E2E-03: should reject unauthenticated request with 401 UNAUTHORIZED`: PASS
  - `S4-M02-01-E2E-04: should reject non-STUDENT role (EMPLOYER) with 403 FORBIDDEN`: PASS
  - `S4-M02-01-E2E-05: should update profile and reconcile StudentSkill associations correctly`: PASS
  - `S4-M02-01-E2E-06: should reject payload with forbidden or relation fields (anti-tampering)`: PASS
  - `S4-M02-01-E2E-07: Resource Ownership is preserved - caller cannot update another student profile`: PASS

### 3.3 Kiểm định toàn bộ Monorepo Quality Gates
- **Toàn bộ Test E2E (`pnpm test:e2e`):** **15/15 test suites passed (315/315 tests pass)**
- **Typecheck (`pnpm typecheck`):** **0 errors** trên cả 3 workspace (`@campusjob/contracts`, `@campusjob/api`, `@campusjob/web`).
- **Linter (`pnpm lint`):** **0 errors**.

---

## 4. Kết luận nghiệm thu
Task **`S4-M02-01`** đã hoàn thành 100% các yêu cầu kỹ thuật và tiêu chí nghiệm thu đề ra, bảo đảm tính nhất quán giữa DTO contract và lược đồ cơ sở dữ liệu, an toàn về phân quyền và chất lượng mã nguồn.
