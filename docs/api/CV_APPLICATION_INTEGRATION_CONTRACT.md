# HỢP ĐỒNG TÍCH HỢP LIÊN MODULE: M02 (CV) → M04 (APPLICATION)
## Contract ID: C-03 · CV Snapshot Integration for Applications

- **Module cung cấp (Provider):** `M02 – Student Profile & CV` (Chịu trách nhiệm: Ngọc Huyền)
- **Module tiêu thụ (Consumer):** `M04 – Application & Interview` (Chịu trách nhiệm: Gia Khang)
- **Phạm vi Use Case liên quan:**
  - **UC38:** Nộp hồ sơ ứng tuyển (M04 yêu cầu trích xuất Snapshot CV của sinh viên).
  - **UC37:** Xem chi tiết hồ sơ ứng tuyển (M04 hiển thị Snapshot CV đã nộp).
  - **UC35:** Xóa CV (M02 đảm bảo không phá hủy dữ liệu Snapshot đã nộp trên M04).
- **Trạng thái:** `APPROVED / READY` (Đã thống nhất giữa hai Module Owner)

---

## 1. Bối cảnh nghiệp vụ & Quyết định kiến trúc (Architecture Decision)

### 1.1 Vấn đề nghiệp vụ
Khi sinh viên nộp hồ sơ vào tin tuyển dụng (UC38), nhà tuyển dụng cần xem xét chính xác hồ sơ năng lực của ứng viên tại thời điểm nộp đơn (UC37). Nếu hệ thống chỉ lưu `cvId` (dạng khóa ngoại tham chiếu đến bảng CV của M02):
1. **Rủi ro thay đổi dữ liệu (Phantom Update):** Sau khi nộp đơn, sinh viên vào cập nhật lại CV (UC34), khiến nội dung hồ sơ ứng tuyển mà nhà tuyển dụng đang đánh giá bị thay đổi ngoài tầm kiểm soát.
2. **Rủi ro mất dữ liệu (Broken Reference):** Sinh viên xóa CV đó trên hệ thống (UC35), dẫn đến việc nhà tuyển dụng không còn xem được CV của ứng viên.

### 1.2 Quyết định kiến trúc: Bản chụp bất biến (Immutable Snapshot Pattern)
- Hai module M02 và M04 thống nhất tuyệt đối áp dụng **Immutable Snapshot Pattern**:
  - Tại thời điểm nộp đơn (UC38), M04 gửi yêu cầu sang M02 để lấy bản chụp dữ liệu CV (`CvSnapshotDto`).
  - M02 kiểm tra quyền sở hữu của sinh viên, đóng gói toàn bộ thông tin ứng viên và CV vào một snapshot kèm dấu thời gian `capturedAt`.
  - M04 nhận snapshot và lưu vĩnh viễn vào trường `Application.cvSnapshot` (kiểu dữ liệu `Json` trong database).
  - Khi xem chi tiết hồ sơ (UC37), M04 đọc trực tiếp từ `Application.cvSnapshot`, hoàn toàn không gọi lại M02.
  - Sinh viên có quyền chỉnh sửa hoặc xóa CV trên M02 mà không làm ảnh hưởng đến các hồ sơ đã nộp thành công trước đó.

---

## 2. Cấu trúc dữ liệu trao đổi (`CvSnapshotDto`)

Cấu trúc đối tượng Snapshot được định nghĩa tập trung trong `@campusjob/contracts`:

```typescript
export interface CvSnapshotDto {
  /** Mã định danh duy nhất của bản chụp snapshot */
  snapshotId: string;

  /** ID của CV gốc tại Module M02 */
  originalCvId: string;

  /** ID hồ sơ sinh viên sở hữu CV */
  studentId: string;

  /** Họ và tên sinh viên tại thời điểm nộp */
  fullName: string;

  /** Email liên hệ của sinh viên */
  email: string;

  /** Số điện thoại liên hệ (nếu có) */
  phone?: string | null;

  /** Tiêu đề CV đã nộp (VD: CV Backend Developer) */
  title: string;

  /** Tóm tắt mục tiêu nghề nghiệp */
  summary?: string | null;

  /** Lịch sử học vấn tại thời điểm nộp */
  educations: EducationItemDto[];

  /** Lịch sử kinh nghiệm làm việc tại thời điểm nộp */
  experiences: ExperienceItemDto[];

  /** Danh sách kỹ năng chuyên môn */
  skills: string[];

  /** Dự án tiêu biểu */
  projects: ProjectItemDto[];

  /** Chứng chỉ, giải thưởng */
  certifications: CertificationItemDto[];

  /** Đường dẫn tệp CV đính kèm (nếu có) */
  fileUrl?: string | null;

  /** Mã định danh FileAsset đính kèm tại thời điểm nộp (nếu có) */
  fileAssetId?: string | null;

  /** Thời điểm chụp bản snapshot (ISO 8601 UTC) */
  capturedAt: string;
}
```

---

## 3. Giao tiếp mã nguồn (Port & Adapter Interface)

Để đảm bảo nguyên tắc kiến trúc Modular Monolith không bị coupling cứng qua database, hai module giao tiếp thông qua **In-Memory Port Interface** (M02 hoàn toàn không truy xuất nội bộ DB của M04 khi cấp phát Snapshot):

### 3.1 Interface do M04/Contracts công bố: `CvSnapshotSource`
Tệp: `packages/contracts/src/index.ts` & `apps/api/src/modules/applications/application/m04-ports.ts`

```typescript
export interface CvSnapshotSource {
  /**
   * M02 kiểm tra quyền sở hữu và trả về bản chụp CV bất biến (deep-cloned & frozen) cho sinh viên
   * @param studentId ID người dùng sinh viên đã xác thực từ JWT (User.id theo C-01/C-05)
   * @param cvId ID của CV muốn nộp
   * @throws BadRequestException (400 VALIDATION_ERROR) Nếu tham số rỗng hoặc CV thiếu dữ liệu tối thiểu
   * @throws NotFoundException (404 STUDENT_PROFILE_NOT_FOUND / CV_NOT_FOUND) Nếu chưa có hồ sơ hoặc CV không thuộc về sinh viên (Anti-IDOR)
   */
  getOwnedSnapshot(studentId: string, cvId: string): Promise<CvSnapshotDto>;
}
```

### 3.2 Triển khai phía M02: `GetCvSnapshotUseCase` & `CvSnapshotSourceAdapter`
- Tệp Use Case: `apps/api/src/modules/students/application/use-cases/get-cv-snapshot.use-case.ts`
- Tệp Adapter: `apps/api/src/modules/students/infrastructure/adapters/cv-snapshot-source.adapter.ts`
- Tệp Module Export: `StudentsModule` cung cấp và export `CvSnapshotSourceAdapter` để `M04Module.register()` có thể inject trực tiếp.

---

## 4. Nguyên tắc bảo mật & Xử lý lỗi (Security & Error Handling)

### 4.1 Chống tấn công IDOR (Insecure Direct Object Reference — Contract C-05)
- Một sinh viên A **tuyệt đối không thể** sử dụng `cvId` của sinh viên B để nộp hồ sơ.
- Logic kiểm tra tại M02 (`GetCvSnapshotUseCase`):
  ```typescript
  const profile = await this.profileRepo.findByUserId(normalizedStudentId);
  if (!profile) {
    throw new NotFoundException({
      statusCode: 404,
      message: 'Không tìm thấy hồ sơ sinh viên.',
      error: 'Not Found',
      code: StudentProfileErrorCode.STUDENT_PROFILE_NOT_FOUND,
    });
  }

  const cv = await this.cvRepo.findById(normalizedCvId);
  if (
    !cv ||
    cv.studentProfileId !== profile.id ||
    (Boolean(cv.userId) && cv.userId !== profile.userId)
  ) {
    throw new NotFoundException({
      statusCode: 404,
      message: 'Không tìm thấy CV hoặc bạn không có quyền truy cập CV này.',
      error: 'Not Found',
      code: CvErrorCode.CV_NOT_FOUND,
    });
  }
  ```
- **Lý do trả về 404 thay vì 403:** Ngăn chặn kẻ tấn công dò quét (enumeration) xem `cvId` của người khác có tồn tại trên hệ thống hay không.

### 4.2 Ma trận lỗi Contract C-03 & C-05

| Tình huống lỗi | Mã HTTP | Mã lỗi nghiệp vụ | Mô tả & Cách xử lý |
| :--- | :---: | :--- | :--- |
| **Không tìm thấy CV** | `404` | `CV_NOT_FOUND` | `cvId` không tồn tại trong hệ thống. |
| **CV không thuộc sinh viên (IDOR)** | `404` | `CV_NOT_FOUND` | `cv.studentProfileId !== profile.id` hoặc `cv.userId !== profile.userId`. Chặn ngay lập tức. |
| **Hồ sơ sinh viên chưa tạo** | `404` | `STUDENT_PROFILE_NOT_FOUND` | Người dùng chưa có `StudentProfile` tương ứng với `studentId` (`User.id`). |
| **Tham số rỗng / CV thiếu thông tin tối thiểu** | `400` | `VALIDATION_ERROR` | `studentId`/`cvId` để trống hoặc CV chưa có tiêu đề (`title`) hợp lệ. |

---

## 5. Ma trận truy vết nghiệm thu (Traceability Matrix — S2-M02-05 & S4-M02-03)

| Tiêu chí nghiệm thu từ Sheet | Thành phần đảm bảo | Cách thức kiểm thử |
| :--- | :--- | :--- |
| **1. M04 nhận đúng CV của sinh viên & đủ 16 trường C-03** | `GetCvSnapshotUseCase` + `CvSnapshotSourceAdapter` + `CvSnapshotDto` | Unit test & Integration test (`INT-17`): truyền `studentId`, `cvId` hợp lệ $\rightarrow$ trả về snapshot đầy đủ 16 trường (`snapshotId`, `originalCvId`, `studentId`, `fullName`, `email`, `phone`, `title`, `summary`, `educations`, `experiences`, `skills`, `projects`, `certifications`, `fileUrl`, `fileAssetId`, `capturedAt`). |
| **2. Không truy cập CV người khác & trả lỗi đúng Contract** | Kiểm tra `profileRepo.findByUserId` + `cv.studentProfileId === profile.id` | Unit test & Integration test (`INT-14`, `INT-18`): Sinh viên A truyền `cvId` của sinh viên B $\rightarrow$ `404 CV_NOT_FOUND`; thiếu hồ sơ $\rightarrow$ `404 STUDENT_PROFILE_NOT_FOUND`; dữ liệu rỗng/thiếu tiêu đề $\rightarrow$ `400 VALIDATION_ERROR`. |
| **3. Không làm thay đổi snapshot khi CV nguồn sửa hoặc xóa** | Deep-clone & `Object.freeze` tại `GetCvSnapshotUseCase` + cột JSON `Application.cvSnapshot` | Unit test & Integration test (`INT-19`, `INT-20`): Sửa toàn bộ CV gốc hoặc xóa chính CV gốc đã nộp (sau khi đơn kết thúc) $\rightarrow$ Snapshot lưu trên `Application` của M04 vẫn giữ nguyên 100% giá trị ban đầu. |
