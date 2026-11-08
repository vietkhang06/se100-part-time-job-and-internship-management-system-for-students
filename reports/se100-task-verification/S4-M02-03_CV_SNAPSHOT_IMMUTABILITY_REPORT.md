# Báo cáo thực hiện và nghiệm thu Task S4-M02-03

- **Mã task:** `S4-M02-03`
- **Tên task:** Bảo đảm CV Snapshot bất biến và chỉ lấy CV thuộc sinh viên
- **Sprint:** Sprint 4
- **Độ ưu tiên:** P0
- **Người thực hiện:** Nguyễn Thị Ngọc Huyền
- **Ngày thực hiện:** 2026-11-09
- **Hợp đồng liên quan:** C-03 (CV Snapshot Integration for Applications), C-05 (Resource Ownership & Anti-IDOR)
- **Task cha / Phụ thuộc:** `S2-M02-05`, `S3-M02-03`, `CvSnapshotSource` contract, `M04 application flow`

---

## 1. Mục tiêu và Tiêu chí nghiệm thu (Acceptance Criteria)

| Tiêu chí | Mô tả yêu cầu | Trạng thái |
|---|---|:---:|
| **AC-01** | **CV của sinh viên khác bị từ chối:** Kiểm tra chặt chẽ `cv.studentProfileId === profile.id` và `cv.userId === profile.userId` dựa trên `StudentProfile` được phân giải từ `studentId` (`User.id` từ JWT); từ chối ngay với `404 CV_NOT_FOUND` (Anti-IDOR). | **ĐẠT (PASS)** |
| **AC-02** | **Snapshot của Application không thay đổi khi CV nguồn được sửa/xóa:** Thực hiện sao chép sâu (Deep Clone) và đóng băng đệ quy (`Object.freeze`) toàn bộ `CvSnapshotDto` cùng các mảng con (`educations`, `experiences`, `skills`, `projects`, `certifications`), đồng thời lưu trữ độc lập vào cột JSON `Application.cvSnapshot` của M04. | **ĐẠT (PASS)** |
| **AC-03** | **Ứng tuyển lưu được dữ liệu snapshot nhất quán (đủ 16 trường theo C-03):** Đóng gói đầy đủ 16 trường của `CvSnapshotDto`: `snapshotId`, `originalCvId`, `studentId`, `fullName`, `email`, `phone`, `title`, `summary`, `educations`, `experiences`, `skills`, `projects`, `certifications`, `fileUrl`, `fileAssetId`, `capturedAt`. | **ĐẠT (PASS)** |
| **AC-04** | **Lỗi nguồn được trả đúng contract & không truy xuất nội bộ DB của M04:** Trả đúng `404 STUDENT_PROFILE_NOT_FOUND`, `404 CV_NOT_FOUND`, `400 VALIDATION_ERROR` (khi tham số rỗng hoặc CV thiếu tiêu đề tối thiểu); `GetCvSnapshotUseCase` và `CvSnapshotSourceAdapter` hoàn toàn cô lập trong M02, không truy xuất bảng hay repository nội bộ của M04. | **ĐẠT (PASS)** |

---

## 2. Chi tiết triển khai kỹ thuật

1. **Chuẩn hóa `GetCvSnapshotUseCase` (`apps/api/src/modules/students/application/use-cases/get-cv-snapshot.use-case.ts`):**
   - Kiểm tra tham số đầu vào `studentId` và `cvId` không rỗng (`400 VALIDATION_ERROR`).
   - Phân giải `studentId` (`User.id` theo `C-01`/`C-05`) sang `StudentProfile` qua `profileRepo.findByUserId`; trả `404 STUDENT_PROFILE_NOT_FOUND` nếu chưa có hồ sơ.
   - Kiểm tra quyền sở hữu kép (`cv.studentProfileId === profile.id` và `cv.userId === profile.userId`); trả `404 CV_NOT_FOUND` nếu CV không tồn tại hoặc thuộc sinh viên khác.
   - Kiểm tra tính toàn vẹn tối thiểu của CV nguồn (`cv.title.trim()` không rỗng, nếu vi phạm trả `400 VALIDATION_ERROR` theo mục 4.2 của `CV_APPLICATION_INTEGRATION_CONTRACT.md`).
   - Sao chép sâu (`cloneAndFreezeItems`) và đóng băng (`Object.freeze`) toàn bộ đối tượng `CvSnapshotDto` gồm đầy đủ 16 trường chuẩn `C-03`.
   - Hoàn toàn không import hay truy vấn cơ sở dữ liệu của phân hệ M04.
2. **Chuẩn hóa `CvSnapshotSourceAdapter` & `StudentsController`:**
   - `CvSnapshotSourceAdapter.getOwnedSnapshot(studentId, cvId)` ủy quyền trực tiếp sang `GetCvSnapshotUseCase.getOwnedSnapshot(studentId, cvId)`.
   - Loại bỏ nhánh kiểm tra `InMemoryCvRepository` trong `StudentsController.getCvSnapshot` để đảm bảo controller production hoàn toàn sạch và gọi trực tiếp `getOwnedSnapshot`.
3. **Đồng bộ tài liệu & Kiểm thử tích hợp:**
   - Cập nhật `docs/api/CV_APPLICATION_INTEGRATION_CONTRACT.md`.
   - Mở rộng Unit Test `get-cv-snapshot.use-case.spec.ts` (kiểm tra đủ 16 trường, deep-clone/deep-freeze, kiểm tra lỗi nguồn 400/404).
   - Mở rộng Integration/E2E Test `apps/api/test/m02-integration.e2e-spec.ts` (`INT-17` đến `INT-20`): kiểm tra nộp đơn lưu đủ 16 trường `CvSnapshotDto`, từ chối CV người khác/CV không tồn tại/thiếu hồ sơ/tham số rỗng, sửa toàn bộ CV gốc không làm đổi snapshot, và xóa chính CV gốc đã nộp (sau khi đơn kết thúc) vẫn bảo toàn 100% snapshot trong M04.

---

## 3. Kết quả Kiểm định Chất lượng (Quality Gates)

- **Unit Tests (`get-cv-snapshot.use-case.spec.ts`, `m04-production-wiring.spec.ts`, `m04-workflow.spec.ts`):** **3/3 test suites passed (18/18 tests pass)**
- **Integration & Production E2E Tests (`m02-integration.e2e-spec.ts`, `m04-production.e2e-spec.ts`, `m04-contract.e2e-spec.ts`):** **3/3 test suites passed (29/29 tests pass)** trên PostgreSQL thực tế (`localhost:5435`).
- **Typecheck (`pnpm --filter @campusjob/api typecheck`):** **0 errors**.
- **Linter (`pnpm --filter @campusjob/api lint`):** **0 errors**.
- **Build (`pnpm --filter @campusjob/api build`):** **PASS**.

