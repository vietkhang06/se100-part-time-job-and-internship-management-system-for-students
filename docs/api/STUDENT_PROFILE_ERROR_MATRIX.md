# CAMPUSJOB — MA TRẬN MÃ LỖI VÀ KIỂM THỰC HỒ SƠ SINH VIÊN (STUDENT PROFILE ERROR MATRIX)

Tài liệu này xác định ma trận ánh xạ chính thức giữa tình huống nghiệp vụ, mã trạng thái HTTP, mã lỗi ứng dụng (`StudentProfileErrorCode`), quy tắc kiểm thực (Validation Rules) và thông điệp phản hồi cho phân hệ Hồ sơ sinh viên (M02).

---

## 1. Ma trận Mã lỗi Nghiệp vụ (Error Matrix)

| Tình huống nghiệp vụ | HTTP Status | Mã lỗi ứng dụng (`code`) | Điều kiện kích hoạt | Thông điệp phản hồi (`message`) |
|---|---|---|---|---|
| **Chưa đăng nhập** | `401 Unauthorized` | `UNAUTHORIZED` | Không gửi header Bearer Token hoặc token không hợp lệ | `"Unauthorized"` |
| **Không đúng vai trò sinh viên** | `403 Forbidden` | `FORBIDDEN` | Người dùng đã đăng nhập nhưng mang vai trò `EMPLOYER`, `MODERATOR`, hoặc `ADMIN` cố tình thao tác hồ sơ sinh viên | `"Bạn không có quyền truy cập tài nguyên này."` |
| **Dữ liệu vi phạm ràng buộc validation** | `400 Bad Request` | `VALIDATION_ERROR` | Bất kỳ trường nào vi phạm độ dài, kiểu dữ liệu hoặc số lượng phần tử mảng | Mảng chi tiết các lỗi từ `class-validator` |
| **Trạng thái tìm việc sai danh mục** | `400 Bad Request` | `INVALID_JOB_SEEKING_STATUS` | Giá trị `jobSeekingStatus` gửi lên không nằm trong enum (`ACTIVELY_LOOKING`, `OPEN_FOR_OPPORTUNITIES`, `NOT_LOOKING`) | `"Trạng thái tìm việc không hợp lệ. Chỉ chấp nhận: ACTIVELY_LOOKING, OPEN_FOR_OPPORTUNITIES, NOT_LOOKING."` |
| **Không tìm thấy hồ sơ sinh viên** | `404 Not Found` | `STUDENT_PROFILE_NOT_FOUND` | Người dùng sinh viên hợp lệ nhưng bản ghi hồ sơ chưa tồn tại trong hệ thống | `"Không tìm thấy hồ sơ sinh viên tương ứng."` |

---

## 2. Bảng Ràng buộc Kiểm thực Dữ liệu Chi tiết (Validation Rules)

Bảng này là căn cứ để nghiệm thu tiêu chí: **"Dữ liệu hợp lệ mới lưu; không thêm trường ngoài scope đã chốt"**:

| Tên trường | Kiểu dữ liệu | Bắt buộc | Ràng buộc kỹ thuật (`class-validator`) | Thông điệp lỗi khi vi phạm |
|---|---|---|---|---|
| `university` | `string` | Không | `@IsOptional()`, `@IsString()`, `@Length(2, 150)` | `"Tên trường đại học phải từ 2 đến 150 ký tự."` |
| `major` | `string` | Không | `@IsOptional()`, `@IsString()`, `@Length(2, 100)` | `"Chuyên ngành đào tạo phải từ 2 đến 100 ký tự."` |
| `graduationYear` | `number` | Không | `@IsOptional()`, `@IsInt()`, `@Min(2000)`, `@Max(2035)` | `"Năm tốt nghiệp phải là số nguyên trong khoảng 2000 đến 2035."` |
| `jobSeekingStatus` | `enum` | Không | `@IsOptional()`, `@IsEnum(JobSeekingStatus)` | `"Trạng thái tìm việc không hợp lệ."` |
| `bio` | `string` | Không | `@IsOptional()`, `@IsString()`, `@MaxLength(500)` | `"Tiểu sử giới thiệu không được vượt quá 500 ký tự."` |
| `skills` | `string[]` | Không | `@IsOptional()`, `@IsArray()`, `@ArrayMaxSize(20)`, `@IsString({ each: true })`, `@MaxLength(50, { each: true })` | `"Danh sách kỹ năng tối đa 20 mục, mỗi mục không quá 50 ký tự."` |

---

## 3. Cấu trúc Payload Phản hồi mẫu

### 3.1 Khi lỗi kiểm thực (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": [
    "Tiểu sử giới thiệu không được vượt quá 500 ký tự.",
    "Năm tốt nghiệp phải là số nguyên trong khoảng 2000 đến 2035."
  ],
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "timestamp": "2026-10-12T00:00:00.000Z",
  "path": "/api/v1/students/profile"
}
```

### 3.2 Khi không đúng vai trò (403 Forbidden)
```json
{
  "statusCode": 403,
  "message": "Bạn không có quyền truy cập tài nguyên này.",
  "error": "Forbidden",
  "code": "FORBIDDEN",
  "timestamp": "2026-10-12T00:00:00.000Z",
  "path": "/api/v1/students/profile"
}
```
