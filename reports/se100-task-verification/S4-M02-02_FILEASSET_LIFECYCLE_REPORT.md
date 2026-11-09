# Báo cáo thực hiện và nghiệm thu Task S4-M02-02

- **Mã task:** `S4-M02-02`
- **Tên task:** Hoàn thiện vòng đời FileAsset và bảo vệ quyền sở hữu tệp CV
- **Sprint:** Sprint 4
- **Độ ưu tiên:** P1
- **Người thực hiện:** Gia Khang
- **Ngày thực hiện:** 2026-11-08
- **Hợp đồng liên quan:** C-03 (CV Snapshot), C-04 (Employer Safe View / Privacy), C-05 (Resource Ownership & Anti-IDOR)
- **Task cha / Phụ thuộc:** `S2-M02-04`, `S3-M02-03`, storage adapter `W2-DO-01`

---

## 1. Mục tiêu và Tiêu chí nghiệm thu (Acceptance Criteria)

| Tiêu chí | Mô tả yêu cầu | Trạng thái |
|---|---|:---:|
| **AC-01** | **Không tải/xóa file người khác:** Kiểm tra chặt chẽ `ownerUserId` từ JWT (`@CurrentUser('id')`); cấm sinh viên gắn, tải hoặc xóa tệp của người khác (`403 FILE_ASSET_FORBIDDEN` khi liên kết/xóa, `404 CV_NOT_FOUND` khi tải xuống chống IDOR); nhà tuyển dụng chỉ được tải tệp CV khi có đơn ứng tuyển nộp vào tin tuyển dụng thuộc công ty mình quản lý (`C-04`). | **ĐẠT (PASS)** |
| **AC-02** | **Sai MIME/size/path bị từ chối:** Kiểm tra chữ ký nhị phân thực tế (magic bytes `%PDF-`, OLE2 `.doc`, ZIP `PK\x03\x04` `.docx`), giới hạn dung lượng $\le 10\text{ MB}$, từ chối tên tệp chứa chuỗi path traversal (`..`, `/`, `\`, `\0`) tại bộ lọc upload và use case, đồng thời bảo vệ `storageKey` UUIDv4 + `realpathSync` tại `LocalStorageService`. | **ĐẠT (PASS)** |
| **AC-03** | **File/metadata không mồ côi sau lỗi:** Bù trừ xóa tệp vật lý ngay khi `prisma.fileAsset.create` lỗi; khóa dòng `SELECT ... FOR UPDATE` khi liên kết/xóa; ngăn gắn trùng 1 `FileAsset` cho nhiều CV (`400 FILE_ASSET_ALREADY_ATTACHED`); nếu xóa vật lý gặp lỗi I/O tạm thời thì giữ trạng thái `PENDING_DELETION` để `retryPendingDeletions` thu hồi lại. | **ĐẠT (PASS)** |
| **AC-04** | **CV đã dùng để ứng tuyển vẫn có snapshot/reference hợp lệ:** Từ chối xóa CV đang có đơn ứng tuyển hoạt động (`409 CV_IN_USE_CANNOT_DELETE`); khi sinh viên thay tệp mới cho CV hoặc xóa CV sau khi đơn ứng tuyển đã kết thúc (`ACCEPTED`/`REJECTED`/`WITHDRAWN`), `FileAssetService` kiểm tra tham chiếu `Application.cvSnapshot.fileAssetId` để bảo toàn tệp vật lý và metadata (`PERMANENT`), giúp nhà tuyển dụng vẫn tải được đúng tệp snapshot đã nộp. | **ĐẠT (PASS)** |

---

## 2. Ma trận Kiểm soát Truy cập & Vòng đời FileAsset (Access-Control Matrix)

| Hành động / Endpoint | Tác nhân | Điều kiện hợp lệ | Phản hồi khi hợp lệ | Hành vi khi vi phạm |
|---|---|---|---|---|
| `POST /api/v1/students/cvs/upload` | Khách vãng lai | Có Bearer JWT hợp lệ | — | `401 UNAUTHORIZED` |
| `POST /api/v1/students/cvs/upload` | `EMPLOYER`, `MODERATOR`, `ADMIN` | Vai trò phải là `STUDENT` | — | `403 FORBIDDEN` |
| `POST /api/v1/students/cvs/upload` | `STUDENT` | Tệp $\le 10\text{ MB}$, magic bytes đúng PDF/DOC/DOCX, tên tệp không chứa `..`/`/`/`\`/`\0` | `201 Created` (`PENDING_UPLOAD`) | `400 Bad Request` |
| `POST /api/v1/students/cvs` & `PATCH /api/v1/students/cvs/:id` | `STUDENT` | `fileAsset.ownerUserId === req.user.id`, `status !== PENDING_DELETION`, chưa gắn vào CV khác | `201`/`200` (`FileAsset` $\rightarrow$ `PERMANENT`) | `403 FILE_ASSET_FORBIDDEN` (tệp người khác), `404 FILE_ASSET_NOT_FOUND`, `400 FILE_ASSET_ALREADY_ATTACHED` |
| `GET /api/v1/students/cvs/:id/download` | `STUDENT` (Chính chủ) | `cv.studentProfileId === profile.id` & `fileAsset.ownerUserId === req.user.id` (hoặc fallback từ `Application.cvSnapshot.fileAssetId` của chính sinh viên nếu CV gốc đã xóa sau khi đơn kết thúc) | `200 OK` (luồng nhị phân) | `404 CV_NOT_FOUND` (khi CV không có tệp) |
| `GET /api/v1/students/cvs/:id/download` | `STUDENT` (Người khác) | Không phải chủ sở hữu CV | — | `404 CV_NOT_FOUND` (Chống IDOR) |
| `GET /api/v1/students/cvs/:id/download` | `EMPLOYER` | Tồn tại `Application` của `cvId` nộp vào `JobPosting` thuộc công ty mà Employer là thành viên `ACTIVE` | `200 OK` (ưu tiên tệp từ `cvSnapshot.fileAssetId`) | `403 FORBIDDEN` (nếu không có đơn ứng tuyển thuộc công ty của mình) |
| `GET /api/v1/students/cvs/:id/download` | `ADMIN` / `MODERATOR` | Kiểm duyệt / đối soát nội dung | `200 OK` (từ `cv.fileAssetId` hoặc `cvSnapshot.fileAssetId`) | `404 CV_NOT_FOUND` |
| `DELETE /api/v1/students/cvs/:id` | `STUDENT` (Chính chủ) | Không có đơn ứng tuyển hoạt động (`SUBMITTED`, `REVIEWING`, `INTERVIEW_SCHEDULED`) | `200 OK`; nếu `fileAssetId` còn trong `Application.cvSnapshot` thì bảo toàn tệp (`PERMANENT`), ngược lại xóa sạch DB & disk | `409 CV_IN_USE_CANNOT_DELETE` (đơn đang hoạt động), `404 CV_NOT_FOUND` (CV người khác) |

---

## 3. Chi tiết các tệp cập nhật và kiểm thử

1. **Dịch vụ lưu trữ & vòng đời tệp (`apps/api/src/shared/storage/file-asset.service.ts`):**
   - Bổ sung kiểm tra tham chiếu `isReferencedByApplicationSnapshot` (`Application.cvSnapshot->>'fileAssetId'`) trong `deleteFileAsset` và `retryPendingDeletions` dưới khóa dòng `FOR UPDATE`.
   - Chặn đọc tệp đang ở trạng thái `PENDING_DELETION` trong `getFile`.
2. **Use Cases & Repository phân hệ M02 (`apps/api/src/modules/students/`):**
   - `upload-cv-file.use-case.ts` & `cvs.controller.ts`: Bật `preservePath: true` trên `FileInterceptor` để chặn triệt để tên tệp chứa ký tự path traversal (`..`, `/`, `\`, `\0`, URL-encoded `%2e%2e`/`%2f`/`%5c`) ngay tại tầng HTTP boundary và Use Case; đối chiếu phần mở rộng khớp với magic bytes thực tế.
   - `prisma-cv.repository.ts`: Kiểm tra `asset.cv` và đối chiếu `asset.ownerUserId === profile.userId` (Defense-in-Depth) ngay bên trong DB transaction dưới khóa dòng `FOR UPDATE`; trả mã lỗi tường minh `400 FILE_ASSET_ALREADY_ATTACHED` khi cố gắn trùng 1 `FileAsset` cho nhiều CV và `403 FILE_ASSET_FORBIDDEN` khi không phải chủ sở hữu.
   - `download-cv-file.use-case.ts`: Siết chặt quyền `EMPLOYER` theo đúng `C-04` (chỉ cho phép tải khi đơn ứng tuyển thuộc `JobPosting` của công ty mà Employer là thành viên `ACTIVE`), đồng thời ưu tiên đọc `fileAssetId` từ `Application.cvSnapshot` để bảo toàn tham chiếu cho cả `EMPLOYER`, `STUDENT` (chính chủ) và `ADMIN`/`MODERATOR` ngay cả khi sinh viên thay tệp mới hoặc xóa CV gốc sau khi đơn kết thúc.
3. **Tài liệu Hợp đồng & Kiểm thử:**
   - Cập nhật `docs/api/CV_API_CONTRACT.md` và `docs/api/CV_ERROR_MATRIX.md`.
   - Mở rộng Unit Test (`file-asset.service.spec.ts`, `upload-cv-file.use-case.spec.ts`, `download-cv-file.use-case.spec.ts`) và E2E Test (`apps/api/test/cv-fileasset-lifecycle.e2e-spec.ts` & `apps/api/test/w2-concurrency-and-upload.e2e-spec.ts`).

---

## 4. Kết quả Kiểm định Chất lượng (Quality Gates)

- **Unit Tests (`file-asset`, `local-storage`, `upload-cv-file`, `download-cv-file`, `cv-management`, `get-cv-snapshot`):** **6/6 test suites passed (74/74 tests pass)**
- **E2E & Concurrency Tests (`cv-fileasset-lifecycle.e2e-spec.ts`, `w2-concurrency-and-upload.e2e-spec.ts`):** **2/2 test suites passed (29/29 tests pass)** trên PostgreSQL thực tế (`localhost:5435`) và Local Storage thực tế.
- **Typecheck (`pnpm typecheck`):** **0 errors** trên cả 3 workspace (`@campusjob/contracts`, `@campusjob/api`, `@campusjob/web`).
- **Linter (`pnpm lint`):** **0 errors**.

---

## 5. Kết luận nghiệm thu
Task **`S4-M02-02`** đã hoàn thành 100% các yêu cầu kỹ thuật, ma trận kiểm soát truy cập (`C-03`, `C-04`, `C-05`) và tiêu chí nghiệm thu về vòng đời `FileAsset` & bảo toàn tham chiếu `Application.cvSnapshot`.

