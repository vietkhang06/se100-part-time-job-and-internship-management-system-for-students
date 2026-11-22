# Báo cáo thực hiện và nghiệm thu Task S7-M02-01

- **Mã task:** `S7-M02-01`
- **Tên task:** Kết nối frontend hồ sơ và CV với API thật
- **Sprint:** Sprint 7
- **Độ ưu tiên:** P1
- **Người thực hiện:** Nguyễn Thị Ngọc Huyền
- **Reviewer:** Minh Phương
- **Ngày thực hiện:** 2026-11-22
- **Hợp đồng liên quan:** C-03 (CV Snapshot), C-04 (Employer Safe View / Privacy), C-05 (Resource Ownership & Anti-IDOR)
- **Task cha / Phụ thuộc:** `S2-M02-02`, `S2-M02-04`; phụ thuộc `S4-M02-01`, `S4-M02-02`, `S4-M02-03`

---

## 1. Mục tiêu và Tiêu chí nghiệm thu (Acceptance Criteria)

| Tiêu chí | Mô tả yêu cầu | Trạng thái |
|---|---|:---:|
| **AC-01** | **Mọi thao tác dùng API thật; không có mock dữ liệu:** Trang Hồ sơ (`/candidate/profile`) và Quản lý CV (`/candidate/cvs`) kết nối 100% tới các endpoint thực tế của M02 (`GET/PATCH /api/v1/students/profile`, `GET/POST/PATCH/DELETE /api/v1/students/cvs`, `PATCH /api/v1/students/cvs/:id/default`, `POST /api/v1/students/cvs/upload`, `GET /api/v1/students/cvs/:id/download`) thông qua `m02Api`. Tuyệt đối không chèn dữ liệu giả hay trường nằm ngoài schema/contract. | **ĐẠT (PASS)** |
| **AC-02** | **Sau refresh dữ liệu còn đúng:** Tầng `m02Api` chờ `AuthProvider` khôi phục phiên và tự động gọi `refreshSession()` (`POST /api/v1/auth/refresh`) khi gặp `401 Unauthorized` (kể cả với yêu cầu JSON và `multipart/form-data`), đồng thời đồng bộ lại state trực tiếp từ dữ liệu PostgreSQL trả về sau mỗi thao tác tạo/sửa/đặt mặc định/xóa. | **ĐẠT (PASS)** |
| **AC-03** | **Lỗi 401/403/413/validation hiển thị dễ hiểu & validation client-server nhất quán:** Bộ kiểm thực `m02-validation.ts` đồng bộ 100% quy tắc với `UpdateStudentProfileDto`, `CreateCvDto`, `UpdateCvDto` và `cvFileFilter` của Backend; hàm `formatM02ErrorMessage` dịch rõ ràng các mã lỗi `401`, `403`, `404`, `409` (`CV_IN_USE_CANNOT_DELETE`), `413` (vượt quá 10MB) và `400` (`VALIDATION_ERROR`, `CV_LIMIT_EXCEEDED`, `CANNOT_UNSET_ONLY_DEFAULT_CV`) sang tiếng Việt dễ hiểu. | **ĐẠT (PASS)** |
| **AC-04** | **Responsive ở `360px` / `768px` / `1440px`:** Toàn bộ biểu mẫu hồ sơ, `SkillEditor`, lưới danh sách CV và các hộp thoại Tạo/Sửa/Xem chi tiết CV sử dụng bố cục thích ứng (`grid-cols-1 sm:grid-cols-2`, `md:grid-cols-2 lg:grid-cols-3`, `flex-wrap`), hiển thị đầy đủ và không tràn ngang ở cả 3 mốc màn hình `360px`, `768px`, `1440px`. | **ĐẠT (PASS)** |

---

## 2. Chi tiết triển khai kỹ thuật

1. **Tầng API Client M02 (`apps/web/src/lib/m02-api.ts`):**
   - Sử dụng `request<T>` có cơ chế tự động làm mới access token khi gặp `401` cho tất cả thao tác JSON (`getProfile`, `updateProfile`, `listCvs`, `getCvDetail`, `createCv`, `updateCv`, `setDefaultCv`, `deleteCv`).
   - Triển khai `uploadCvFile(file: File)` gửi `FormData` lên `POST /api/v1/students/cvs/upload` (không gán cứng `Content-Type: application/json` để trình duyệt tự sinh boundary `multipart/form-data`), hỗ trợ retry `401` và bắt lỗi `413 Payload Too Large`.
   - Triển khai `downloadCvFile(cvId, fallbackFileName)` gọi `GET /api/v1/students/cvs/:id/download` kèm Bearer token, đọc tên tệp từ header `Content-Disposition` và tải tệp về trình duyệt.
2. **Tầng Kiểm thực & Chuẩn hóa Thông điệp Lỗi (`apps/web/src/lib/m02-validation.ts`):**
   - Đồng bộ toàn bộ giới hạn độ dài, định dạng tháng `YYYY-MM`, URL `http/https`, số lượng kỹ năng (`20` cho Hồ sơ, `30` cho CV, tối đa `50` ký tự/kỹ năng), số lượng mục con (`10` mục học vấn/kinh nghiệm/dự án/chứng chỉ) và giới hạn tệp tải lên (`.pdf`, `.doc`, `.docx`, $\le 10\text{ MB}$).
   - Chuẩn hóa hàm `formatM02ErrorMessage` cho các mã trạng thái `400`, `401`, `403`, `404`, `409`, `413`.
3. **Component `SkillEditor` (`apps/web/src/components/students/skill-editor.tsx`):**
   - Cho phép thêm từng kỹ năng hoặc danh sách kỹ năng ngăn cách bằng dấu phẩy qua phím `Enter` hoặc nút `+ Thêm kỹ năng`.
   - Tự động loại bỏ trùng lặp không phân biệt hoa/thường, kiểm tra độ dài tối đa `50` ký tự, hiển thị thẻ kỹ năng kèm nút xóa từng mục (`×`) hoặc `Xóa tất cả kỹ năng`.
4. **Trang Hồ sơ cá nhân (`apps/web/src/app/candidate/profile/page.tsx`):**
   - Hiển thị thẻ thông tin định danh tài khoản (read-only từ `StudentProfileDto`: `fullName`, `email`, `phone`, `isCampusVerified`, `campusEmail`, `updatedAt`).
   - Kết nối form học vấn, trạng thái tìm việc (`JobSeekingStatus`), tiểu sử (`bio` kèm bộ đếm `0/500`) và `SkillEditor` với `PATCH /api/v1/students/profile` (cho phép xóa toàn bộ kỹ năng về `[]` và khôi phục dữ liệu gốc).
5. **Trang Quản lý CV (`apps/web/src/app/candidate/cvs/page.tsx`):**
   - Khắc phục lỗi trạng thái `submitting` khi tạo CV và thống nhất trình biên tập cho cả **Tạo CV mới** và **Chỉnh sửa CV**.
   - Bổ sung khu vực **Tải lên tệp CV đính kèm (PDF/DOC/DOCX $\le 10\text{ MB}$)** kết nối trực tiếp tới `POST /api/v1/students/cvs/upload`, liên kết `fileAssetId` vào CV và hỗ trợ tải xuống tệp qua `GET /api/v1/students/cvs/:id/download`.
   - Hỗ trợ thêm/sửa/xóa đầy đủ 4 nhóm mục con theo đúng Contract `C-03` (`educations`, `experiences`, `projects`, `certifications`) mà không tự chèn dữ liệu giả.

---

## 3. Smoke & Responsive Checklist

| Hạng mục kiểm tra | Kịch bản | Kết quả |
|---|---|:---:|
| **Hồ sơ — Tải & Hiển thị (`UC11`)** | Mở `/candidate/profile`, tải dữ liệu từ `GET /api/v1/students/profile` | **PASS** |
| **Hồ sơ — Skill Editor & Cập nhật (`UC12`)** | Thêm/xóa kỹ năng trên `SkillEditor`, lưu qua `PATCH /api/v1/students/profile` | **PASS** |
| **Hồ sơ — Bền vững sau Refresh (F5)** | Refresh trình duyệt, tự động gọi `/auth/refresh` và giữ nguyên dữ liệu đã lưu | **PASS** |
| **CV — Upload PDF & Tạo CV (`UC33` / `UC33b`)** | Chọn tệp PDF $\le 10\text{ MB}$, tải lên `/students/cvs/upload` lấy `fileAssetId` và tạo CV | **PASS** |
| **CV — Chặn tệp > 10MB (`413`) / sai định dạng** | Chọn tệp $> 10\text{ MB}$ hoặc sai đuôi tệp, hiển thị thông báo lỗi 10MB (`413`) dễ hiểu | **PASS** |
| **CV — Xem chi tiết, Tải PDF, Sửa, Đặt mặc định (`UC32` / `UC34`)** | Mở xem trước khổ A4, tải tệp PDF đính kèm, chỉnh sửa mục con, đổi CV mặc định | **PASS** |
| **CV — Xóa CV & Chặn xóa CV đang ứng tuyển (`UC35` / `409`)** | Xóa CV không ứng tuyển thành công; CV đang gắn đơn ứng tuyển hiển thị rõ lỗi `409` | **PASS** |
| **Responsive `360px` / `768px` / `1440px`** | Kiểm tra bố cục Mobile (`360px`), Tablet (`768px`), Desktop (`1440px`) không tràn ngang | **PASS** |

---

## 4. Kết quả Kiểm định Chất lượng (Quality Gates)

- **Web Unit Tests (`pnpm --filter @campusjob/web test`):** **3/3 test suites passed (`m02-validation.spec.ts`, `m02-api.spec.ts`, `validation.spec.ts` — 14/14 tests pass)**.
- **Web Typecheck (`pnpm --filter @campusjob/web typecheck`):** **0 errors**.
- **Web Linter (`pnpm --filter @campusjob/web lint`):** **0 errors**.
- **Web Production Build (`pnpm --filter @campusjob/web build`):** **PASS (34/34 routes compiled)**.

