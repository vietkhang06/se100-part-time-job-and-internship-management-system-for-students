# CAMPUSJOB — MA TRẬN MÃ LỖI VÀ KIỂM THỰC QUẢN LÝ CV (CV ERROR MATRIX & RULE MATRIX)

Tài liệu này xác định ma trận ánh xạ chính thức giữa tình huống nghiệp vụ, mã trạng thái HTTP, mã lỗi ứng dụng (`CvErrorCode`), quy tắc kiểm thực (Validation Rules), kiểm soát quyền sở hữu (Ownership & IDOR Prevention) và quy tắc CV mặc định (Default CV Invariant) cho phân hệ Quản lý CV (M02).

---

## 1. Ma trận Mã lỗi Nghiệp vụ (CvErrorCode Matrix)

| Tình huống nghiệp vụ | HTTP Status | Mã lỗi ứng dụng (`code`) | Điều kiện kích hoạt | Thông điệp phản hồi chuẩn (`message`) |
|---|---|---|---|---|
| **Chưa xác thực** | `401 Unauthorized` | `UNAUTHORIZED` | Không gửi Bearer Token hoặc token JWT không hợp lệ / hết hạn | `"Unauthorized"` |
| **Sai vai trò người dùng** | `403 Forbidden` | `FORBIDDEN` | Người dùng đã đăng nhập nhưng không phải vai trò `STUDENT` (ví dụ: `EMPLOYER`, `MODERATOR`, `ADMIN`) | `"Bạn không có quyền truy cập tài nguyên này."` |
| **Vi phạm kiểm thực dữ liệu** | `400 Bad Request` | `VALIDATION_ERROR` | Bất kỳ trường nào vi phạm kiểu dữ liệu, độ dài ký tự, định dạng ngày tháng hoặc số lượng phần tử mảng | Mảng thông điệp lỗi chi tiết từ `class-validator` |
| **Không tìm thấy CV** | `404 Not Found` | `CV_NOT_FOUND` | CV không tồn tại trên hệ thống HOẶC CV thuộc sở hữu của sinh viên khác (chống IDOR / ID harvesting) | `"Không tìm thấy CV hoặc bạn không có quyền truy cập."` |
| **Vượt quá số lượng CV cho phép** | `400 Bad Request` | `CV_LIMIT_EXCEEDED` | Sinh viên đã sở hữu đủ 10 CV và cố tình tạo thêm CV mới | `"Mỗi sinh viên chỉ được tạo tối đa 10 CV. Vui lòng xóa bớt CV không sử dụng."` |
| **Không thể hủy cờ mặc định duy nhất** | `400 Bad Request` | `CANNOT_UNSET_ONLY_DEFAULT_CV` | Sinh viên cố tình gửi `isDefault: false` cho CV mặc định duy nhất của mình khi không có CV khác thay thế | `"Hệ thống yêu cầu phải luôn có một CV mặc định. Vui lòng chọn một CV khác làm mặc định thay thế."` |
| **CV đang dùng trong đơn ứng tuyển** | `409 Conflict` | `CV_IN_USE_CANNOT_DELETE` | Sinh viên yêu cầu xóa CV đang được gắn với đơn ứng tuyển chưa hoàn tất (`SUBMITTED`, `REVIEWING`, `INTERVIEW_SCHEDULED`) | `"Không thể xóa CV đang được sử dụng trong hồ sơ ứng tuyển đang hoạt động."` |

---

## 2. Bảng Ràng buộc Kiểm thực Dữ liệu Chi tiết (Validation Rules Matrix)

Bảng quy chuẩn này là căn cứ để nghiệm thu tiêu chí: **"FE/BE thống nhất schema; dữ liệu hợp lệ mới lưu; không thêm trường ngoài scope đã chốt"**:

### 2.1 Cấp độ CV gốc (`CreateCvDto` / `UpdateCvDto`)

| Tên trường | Kiểu dữ liệu | Bắt buộc (Create) | Bắt buộc (Update) | Ràng buộc kỹ thuật (`class-validator`) | Thông điệp lỗi khi vi phạm |
|---|---|---|---|---|---|
| `title` | `string` | **Có** | Không | `@IsNotEmpty()`, `@IsString()`, `@Length(2, 100)` | `"Tiêu đề CV phải từ 2 đến 100 ký tự."` |
| `summary` | `string` | Không | Không | `@IsOptional()`, `@IsString()`, `@MaxLength(1000)` | `"Tóm tắt mục tiêu nghề nghiệp không được vượt quá 1000 ký tự."` |
| `isDefault` | `boolean` | Không | Không | `@IsOptional()`, `@IsBoolean()` | `"Giá trị CV mặc định phải là true hoặc false."` |
| `fileUrl` | `string` | Không | Không | `@IsOptional()`, `@IsUrl()`, `@MaxLength(500)` | `"Đường dẫn tệp CV phải là URL hợp lệ và không quá 500 ký tự."` |
| `skills` | `string[]` | Không | Không | `@IsOptional()`, `@IsArray()`, `@ArrayMaxSize(30)`, `@IsString({ each: true })`, `@MaxLength(50, { each: true })` | `"Danh sách kỹ năng tối đa 30 mục, mỗi mục không quá 50 ký tự."` |
| `educations` | `EducationItemDto[]` | Không | Không | `@IsOptional()`, `@IsArray()`, `@ArrayMaxSize(10)`, `@ValidateNested({ each: true })` | `"Danh sách học vấn tối đa 10 mục."` |
| `experiences` | `ExperienceItemDto[]` | Không | Không | `@IsOptional()`, `@IsArray()`, `@ArrayMaxSize(10)`, `@ValidateNested({ each: true })` | `"Danh sách kinh nghiệm tối đa 10 mục."` |
| `projects` | `ProjectItemDto[]` | Không | Không | `@IsOptional()`, `@IsArray()`, `@ArrayMaxSize(10)`, `@ValidateNested({ each: true })` | `"Danh sách dự án tối đa 10 mục."` |
| `certifications` | `CertificationItemDto[]` | Không | Không | `@IsOptional()`, `@IsArray()`, `@ArrayMaxSize(10)`, `@ValidateNested({ each: true })` | `"Danh sách chứng chỉ tối đa 10 mục."` |

### 2.2 Cấp độ Mục con (Sub-items)

#### A. Học vấn (`EducationItemDto`)
- `school` (`string`, bắt buộc): `@IsNotEmpty()`, `@Length(2, 150)` — `"Tên trường học phải từ 2 đến 150 ký tự."`
- `major` (`string`, bắt buộc): `@IsNotEmpty()`, `@Length(2, 100)` — `"Chuyên ngành đào tạo phải từ 2 đến 100 ký tự."`
- `startDate` (`string`, bắt buộc): `@IsNotEmpty()`, `@Matches(/^\d{4}-\d{2}$/)` — `"Thời gian bắt đầu học phải theo định dạng YYYY-MM (ví dụ 2021-09)."`
- `endDate` (`string`, tùy chọn): `@IsOptional()`, `@Matches(/^\d{4}-\d{2}$/)` — `"Thời gian kết thúc học phải theo định dạng YYYY-MM."`
- `isCurrent` (`boolean`, tùy chọn): `@IsOptional()`, `@IsBoolean()`
- `gpa` (`string`, tùy chọn): `@IsOptional()`, `@MaxLength(20)` — `"Điểm trung bình (GPA) không quá 20 ký tự."`
- `description` (`string`, tùy chọn): `@IsOptional()`, `@MaxLength(500)` — `"Mô tả quá trình học tập tối đa 500 ký tự."`

#### B. Kinh nghiệm (`ExperienceItemDto`)
- `company` (`string`, bắt buộc): `@IsNotEmpty()`, `@Length(2, 150)` — `"Tên công ty/tổ chức phải từ 2 đến 150 ký tự."`
- `position` (`string`, bắt buộc): `@IsNotEmpty()`, `@Length(2, 100)` — `"Vị trí làm việc phải từ 2 đến 100 ký tự."`
- `startDate` (`string`, bắt buộc): `@IsNotEmpty()`, `@Matches(/^\d{4}-\d{2}$/)` — `"Thời gian bắt đầu làm việc phải theo định dạng YYYY-MM."`
- `endDate` (`string`, tùy chọn): `@IsOptional()`, `@Matches(/^\d{4}-\d{2}$/)` — `"Thời gian kết thúc làm việc phải theo định dạng YYYY-MM."`
- `isCurrent` (`boolean`, tùy chọn): `@IsOptional()`, `@IsBoolean()`
- `description` (`string`, tùy chọn): `@IsOptional()`, `@MaxLength(1000)` — `"Mô tả kinh nghiệm tối đa 1000 ký tự."`

#### C. Dự án (`ProjectItemDto`)
- `name` (`string`, bắt buộc): `@IsNotEmpty()`, `@Length(2, 150)` — `"Tên dự án phải từ 2 đến 150 ký tự."`
- `role` (`string`, tùy chọn): `@IsOptional()`, `@MaxLength(100)` — `"Vai trò trong dự án tối đa 100 ký tự."`
- `startDate` (`string`, tùy chọn): `@IsOptional()`, `@Matches(/^\d{4}-\d{2}$/)`
- `endDate` (`string`, tùy chọn): `@IsOptional()`, `@Matches(/^\d{4}-\d{2}$/)`
- `url` (`string`, tùy chọn): `@IsOptional()`, `@IsUrl()`, `@MaxLength(500)` — `"Đường dẫn dự án phải là URL hợp lệ."`
- `description` (`string`, tùy chọn): `@IsOptional()`, `@MaxLength(1000)` — `"Mô tả dự án tối đa 1000 ký tự."`

#### D. Chứng chỉ (`CertificationItemDto`)
- `name` (`string`, bắt buộc): `@IsNotEmpty()`, `@Length(2, 150)` — `"Tên chứng chỉ phải từ 2 đến 150 ký tự."`
- `issuer` (`string`, bắt buộc): `@IsNotEmpty()`, `@Length(2, 150)` — `"Đơn vị cấp chứng chỉ phải từ 2 đến 150 ký tự."`
- `issueDate` (`string`, tùy chọn): `@IsOptional()`, `@Matches(/^\d{4}-\d{2}$/)`
- `url` (`string`, tùy chọn): `@IsOptional()`, `@IsUrl()`, `@MaxLength(500)`

---

## 3. Ma trận Kiểm soát Quyền sở hữu (Ownership Matrix & Chống IDOR)

| Thao tác API | Định danh đối tượng | Cách thức kiểm soát quyền | Hành vi khi vi phạm |
|---|---|---|---|
| `GET /students/cvs` | Toàn bộ danh sách CV | Lọc bắt buộc theo `userId === req.user.id` từ JWT token | Không bao giờ trả về CV của người khác |
| `GET /students/cvs/:id` | CV theo `id` | Kiểm tra `cv.userId === req.user.id` | Trả về `404 Not Found` (`CV_NOT_FOUND`) |
| `POST /students/cvs` | Tạo CV mới | Tự động gán `userId = req.user.id`, không nhận `userId` từ body | Sinh viên chỉ tạo được CV cho chính mình |
| `PATCH /students/cvs/:id` | Cập nhật CV | Kiểm tra `cv.userId === req.user.id` | Trả về `404 Not Found` (`CV_NOT_FOUND`) |
| `PATCH /students/cvs/:id/default` | Đặt CV mặc định | Kiểm tra `cv.userId === req.user.id` | Trả về `404 Not Found` (`CV_NOT_FOUND`) |
| `DELETE /students/cvs/:id` | Xóa CV | Kiểm tra `cv.userId === req.user.id` | Trả về `404 Not Found` (`CV_NOT_FOUND`) |

---

## 4. Ma trận Bất biến CV Mặc định (Default CV Invariant Matrix)

Nguyên tắc hệ thống: **"Tại mọi thời điểm, nếu sinh viên sở hữu ít nhất 1 CV, thì phải có DUY NHẤT 1 CV được đánh dấu mặc định (`isDefault = true`)"**.

| Sự kiện tác động | Trạng thái hiện tại | Dữ liệu đầu vào | Hành vi xử lý hệ thống | Kết quả sau xử lý |
|---|---|---|---|---|
| **Tạo CV đầu tiên** | Chưa có CV nào (count = 0) | `isDefault` bất kỳ (`true`, `false`, `null`) | Hệ thống tự động cưỡng chế gán `isDefault = true` | Có 1 CV mặc định |
| **Tạo CV tiếp theo** | Đã có >= 1 CV | `isDefault: true` | Đặt CV mới là `true`, cập nhật tất cả CV cũ thành `false` trong transaction | Có duy nhất 1 CV mới là mặc định |
| **Tạo CV tiếp theo** | Đã có >= 1 CV | `isDefault: false` (hoặc omitted) | Lưu CV mới với `isDefault = false`, giữ nguyên CV mặc định cũ | CV mặc định cũ giữ nguyên |
| **Đặt làm mặc định (`default`)** | Đã có >= 1 CV | Gọi `PATCH :id/default` | Đặt CV `:id` thành `true`, toàn bộ CV khác thành `false` | CV `:id` là mặc định duy nhất |
| **Cập nhật hủy cờ mặc định** | CV `:id` đang là CV mặc định duy nhất | Gửi `isDefault: false` | Từ chối yêu cầu, ném mã lỗi `CANNOT_UNSET_ONLY_DEFAULT_CV` (HTTP 400) | Giữ nguyên cờ mặc định |
| **Xóa CV không mặc định** | Có n CV (n > 1), xóa CV `isDefault = false` | Gọi `DELETE :id` | Xóa CV thành công nếu không bị vướng đơn ứng tuyển | CV mặc định cũ giữ nguyên |
| **Xóa CV mặc định** | Có n CV (n > 1), xóa CV `isDefault = true` | Gọi `DELETE :id` | Xóa CV thành công; tự động chuyển cờ `isDefault = true` sang CV có `updatedAt` gần nhất còn lại | Đảm bảo luôn có 1 CV mặc định |
| **Xóa CV duy nhất** | Có duy nhất 1 CV | Gọi `DELETE :id` | Xóa CV thành công; sinh viên về trạng thái 0 CV | Số lượng CV = 0 |

---

## 5. Cấu trúc Payload Phản hồi mẫu

### 5.1 Lỗi kiểm thực dữ liệu (`400 Bad Request` — `VALIDATION_ERROR`)
```json
{
  "statusCode": 400,
  "message": [
    "Tiêu đề CV phải từ 2 đến 100 ký tự.",
    "Danh sách kỹ năng tối đa 30 mục, mỗi mục không quá 50 ký tự."
  ],
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "timestamp": "2026-10-14T02:00:00.000Z",
  "path": "/api/v1/students/cvs"
}
```

### 5.2 Lỗi vượt quá số lượng CV (`400 Bad Request` — `CV_LIMIT_EXCEEDED`)
```json
{
  "statusCode": 400,
  "message": "Mỗi sinh viên chỉ được tạo tối đa 10 CV. Vui lòng xóa bớt CV không sử dụng.",
  "error": "Bad Request",
  "code": "CV_LIMIT_EXCEEDED",
  "timestamp": "2026-10-14T02:00:00.000Z",
  "path": "/api/v1/students/cvs"
}
```

### 5.3 Lỗi hủy cờ CV mặc định duy nhất (`400 Bad Request` — `CANNOT_UNSET_ONLY_DEFAULT_CV`)
```json
{
  "statusCode": 400,
  "message": "Hệ thống yêu cầu phải luôn có một CV mặc định. Vui lòng chọn một CV khác làm mặc định thay thế.",
  "error": "Bad Request",
  "code": "CANNOT_UNSET_ONLY_DEFAULT_CV",
  "timestamp": "2026-10-14T02:00:00.000Z",
  "path": "/api/v1/students/cvs/7b13e9a0-6b68-45e2-8ea5-6b4d326f50b1"
}
```

### 5.4 Lỗi không tìm thấy hoặc sai quyền sở hữu (`404 Not Found` — `CV_NOT_FOUND`)
```json
{
  "statusCode": 404,
  "message": "Không tìm thấy CV hoặc bạn không có quyền truy cập.",
  "error": "Not Found",
  "code": "CV_NOT_FOUND",
  "timestamp": "2026-10-14T02:00:00.000Z",
  "path": "/api/v1/students/cvs/00000000-0000-0000-0000-000000000000"
}
```

### 5.5 Lỗi xóa CV đang dùng trong đơn ứng tuyển (`409 Conflict` — `CV_IN_USE_CANNOT_DELETE`)
```json
{
  "statusCode": 409,
  "message": "Không thể xóa CV đang được sử dụng trong hồ sơ ứng tuyển đang hoạt động.",
  "error": "Conflict",
  "code": "CV_IN_USE_CANNOT_DELETE",
  "timestamp": "2026-10-14T02:00:00.000Z",
  "path": "/api/v1/students/cvs/7b13e9a0-6b68-45e2-8ea5-6b4d326f50b1"
}
```
