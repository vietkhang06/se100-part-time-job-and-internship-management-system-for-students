# CAMPUSJOB — HỢP ĐỒNG API HỒ SƠ SINH VIÊN (STUDENT PROFILE API CONTRACT C-03/C-05)

Tài liệu này chuẩn hóa hợp đồng giao tiếp API Hồ sơ sinh viên (Student Profile API Contract) cho phân hệ M02, đóng vai trò nguồn chân lý (Single Source of Truth) giữa Backend (`apps/api`), Frontend (`apps/web`), và gói hợp đồng dùng chung (`packages/contracts`).

---

## 1. Tiêu chuẩn chung

- **Base URL:** `/api/v1`
- **Format dữ liệu:** `application/json; charset=utf-8`
- **Cơ chế xác thực:** Bearer JWT Access Token gửi qua header `Authorization: Bearer <accessToken>`.
- **Vai trò bắt buộc:** `STUDENT` (chỉ tài khoản có vai trò sinh viên mới được sở hữu và thao tác trên hồ sơ này).
- **Nguyên tắc bảo mật quyền sở hữu (Ownership Enforcement):**
  - Tuyệt đối **không nhận `studentId` hoặc `userId` từ URL path hoặc Request Body** khi đọc/sửa hồ sơ.
  - Toàn bộ định danh người dùng được trích xuất an toàn từ AuthContext JWT token (`req.user.id`).
  - Ngăn chặn hoàn toàn lỗ hổng IDOR (Insecure Direct Object Reference) — Sinh viên A không thể can thiệp dữ liệu của Sinh viên B.
- **Chuẩn định dạng lỗi:** `ApiErrorResponse` (`packages/contracts`):
  ```json
  {
    "statusCode": 400,
    "message": "Chi tiết lỗi hoặc mảng lỗi validation",
    "error": "Bad Request",
    "code": "VALIDATION_ERROR",
    "timestamp": "2026-10-12T00:00:00.000Z",
    "path": "/api/v1/students/profile",
    "correlationId": "optional-uuid"
  }
  ```

---

## 2. Danh mục Trạng thái Tìm việc (`JobSeekingStatus`)

Trạng thái tìm việc của sinh viên được kiểm soát chặt chẽ theo danh mục cố định, không chấp nhận giá trị tùy ý ngoài danh mục:

| Giá trị Enum | Ý nghĩa nghiệp vụ | Trạng thái hiển thị |
|---|---|---|
| `ACTIVELY_LOOKING` | Đang tích cực tìm việc / thực tập | Sẵn sàng đi làm ngay, ưu tiên hiển thị cho nhà tuyển dụng |
| `OPEN_FOR_OPPORTUNITIES` | Sẵn sàng đón nhận cơ hội phù hợp | Đang cân nhắc, chỉ nhận việc thực sự phù hợp |
| `NOT_LOOKING` | Tạm thời chưa có nhu cầu tìm việc | Tập trung học tập / đã có việc làm ổn định |

---

## 3. Chi tiết các Endpoint trong phạm vi S2-M02-01

### 3.1 Xem hồ sơ sinh viên cá nhân (Get My Student Profile)

- **Endpoint:** `GET /api/v1/students/profile`
- **Yêu cầu xác thực:** Bearer Token (`JwtAuthGuard`, `RolesGuard(UserRole.STUDENT)`)
- **Mô tả:** Lấy thông tin chi tiết hồ sơ của sinh viên đang đăng nhập.

#### Request Header
```http
Authorization: Bearer <accessToken>
```

#### Phản hồi thành công (`200 OK`)
```json
{
  "profile": {
    "id": "e4a2c2b3-5c74-4b53-8d65-1d22dfb43a91",
    "userId": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
    "fullName": "Nguyễn Văn A",
    "email": "student@example.com",
    "phone": "0901234567",
    "avatarUrl": null,
    "university": "Đại học Công nghệ Thông tin - ĐHQG TP.HCM",
    "major": "Kỹ thuật Phần mềm",
    "graduationYear": 2025,
    "jobSeekingStatus": "ACTIVELY_LOOKING",
    "bio": "Sinh viên năm cuối đam mê phát triển hệ thống web backend và cloud native.",
    "skills": ["TypeScript", "NestJS", "React", "PostgreSQL"],
    "isCampusVerified": true,
    "campusEmail": "21520001@gm.uit.edu.vn",
    "createdAt": "2026-10-12T00:00:00.000Z",
    "updatedAt": "2026-10-12T00:00:00.000Z"
  }
}
```

---

### 3.2 Cập nhật hồ sơ sinh viên cá nhân (Update My Student Profile)

- **Endpoint:** `PATCH /api/v1/students/profile`
- **Yêu cầu xác thực:** Bearer Token (`JwtAuthGuard`, `RolesGuard(UserRole.STUDENT)`)
- **Mô tả:** Cập nhật thông tin học vấn, kỹ năng, tiểu sử và trạng thái tìm việc của sinh viên đang đăng nhập.
- **Ràng buộc:** Mọi trường đều là tùy chọn (partial update), chỉ lưu khi tất cả dữ liệu gửi lên hợp lệ.

#### Request Header
```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

#### Request Body (`UpdateStudentProfileRequestDto`)
| Trường | Kiểu dữ liệu | Bắt buộc | Ràng buộc kiểm thực | Ý nghĩa |
|---|---|---|---|---|
| `university` | `string` | Không | Tối thiểu 2, tối đa 150 ký tự | Tên trường đại học |
| `major` | `string` | Không | Tối thiểu 2, tối đa 100 ký tự | Ngành đào tạo |
| `graduationYear` | `number` | Không | Số nguyên từ 2000 đến 2035 | Năm tốt nghiệp dự kiến |
| `jobSeekingStatus` | `JobSeekingStatus` | Không | Thuộc 1 trong 3 giá trị Enum quy định | Trạng thái tìm việc |
| `bio` | `string` | Không | Tối đa 500 ký tự | Giới thiệu ngắn về bản thân |
| `skills` | `string[]` | Không | Tối đa 20 kỹ năng, mỗi mục tối đa 50 ký tự | Danh sách kỹ năng |

*Ví dụ Request Body:*
```json
{
  "university": "Đại học Công nghệ Thông tin - ĐHQG TP.HCM",
  "major": "Kỹ thuật Phần mềm",
  "graduationYear": 2025,
  "jobSeekingStatus": "ACTIVELY_LOOKING",
  "bio": "Sinh viên năm cuối mong muốn tìm vị trí thực tập backend developer.",
  "skills": ["TypeScript", "NestJS", "PostgreSQL", "Docker"]
}
```

#### Phản hồi thành công (`200 OK`)
```json
{
  "message": "Cập nhật hồ sơ sinh viên thành công.",
  "profile": {
    "id": "e4a2c2b3-5c74-4b53-8d65-1d22dfb43a91",
    "userId": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
    "fullName": "Nguyễn Văn A",
    "email": "student@example.com",
    "phone": "0901234567",
    "avatarUrl": null,
    "university": "Đại học Công nghệ Thông tin - ĐHQG TP.HCM",
    "major": "Kỹ thuật Phần mềm",
    "graduationYear": 2025,
    "jobSeekingStatus": "ACTIVELY_LOOKING",
    "bio": "Sinh viên năm cuối mong muốn tìm vị trí thực tập backend developer.",
    "skills": ["TypeScript", "NestJS", "PostgreSQL", "Docker"],
    "isCampusVerified": true,
    "campusEmail": "21520001@gm.uit.edu.vn",
    "createdAt": "2026-10-12T00:00:00.000Z",
    "updatedAt": "2026-10-12T00:05:00.000Z"
  }
}
```
