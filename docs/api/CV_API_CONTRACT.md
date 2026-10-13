# CAMPUSJOB — HỢP ĐỒNG API QUẢN LÝ CV (CV & RESUME API CONTRACT C-03/C-04/C-05)

Tài liệu này chuẩn hóa hợp đồng giao tiếp API Quản lý CV (CV & Resume API Contract) cho phân hệ M02, đóng vai trò nguồn chân lý (Single Source of Truth) giữa Backend (`apps/api`), Frontend (`apps/web`), và gói hợp đồng dùng chung (`packages/contracts`).

- **Mã phân hệ:** M02 – Student Profile & CV
- **Phạm vi Use Case:** UC31–UC35 (Mã chức năng OOAD: CV01–CV05)
- **Hợp đồng liên module:**
  - **C-03 (Outbound → M04 Application):** Cung cấp `CvSnapshot` và tra cứu CV hợp lệ khi nộp hồ sơ.
  - **C-04 (Inbound ← M03 Employer & Job):** Permitted CV view / Giới hạn hiển thị an toàn theo ngữ cảnh tuyển dụng.
  - **C-05 (Inbound ← M01 Account):** Xác thực quyền sở hữu (Ownership) dựa trên `userId` trích xuất từ JWT token.

---

## 1. Tiêu chuẩn chung

- **Base URL:** `/api/v1`
- **Format dữ liệu:** `application/json; charset=utf-8`
- **Cơ chế xác thực:** Bearer JWT Access Token gửi qua header `Authorization: Bearer <accessToken>`.
- **Vai trò bắt buộc:** `STUDENT` (`JwtAuthGuard`, `RolesGuard(UserRole.STUDENT)`).
- **Nguyên tắc bảo mật quyền sở hữu (Ownership Enforcement & Chống IDOR):**
  - Tuyệt đối **không nhận `studentId` hoặc `userId` từ URL path hoặc Request Body**.
  - Toàn bộ định danh người dùng được trích xuất an toàn từ AuthContext JWT token (`req.user.id`).
  - Mọi thao tác truy vấn/cập nhật/xóa theo `cvId` đều phải xác thực `cv.userId === req.user.id`.
  - Nếu CV không tồn tại hoặc thuộc người khác: trả về `404 Not Found` (`CV_NOT_FOUND`) để ngăn chặn việc dò quét ID (ID harvesting).
- **Chuẩn định dạng lỗi:** `ApiErrorResponse` / `CvErrorResponse` (`@campusjob/contracts`):
  ```json
  {
    "statusCode": 400,
    "message": "Chi tiết lỗi hoặc mảng lỗi validation",
    "error": "Bad Request",
    "code": "VALIDATION_ERROR",
    "timestamp": "2026-10-14T02:00:00.000Z",
    "path": "/api/v1/students/cvs",
    "correlationId": "optional-uuid"
  }
  ```

---

## 2. Chi tiết các Endpoint trong phạm vi S2-M02-03 (UC31–UC35 / CV01–CV05)

| Mã UC | Mã OOAD | Phương thức | Tuyến đường (Endpoint) | Mục tiêu nghiệp vụ |
|---|---|---|---|---|
| **UC31** | **CV01** | `GET` | `/api/v1/students/cvs` | Xem danh sách CV thuộc sở hữu của sinh viên và xác định CV mặc định |
| **UC32** | **CV02** | `GET` | `/api/v1/students/cvs/:id` | Xem chi tiết toàn bộ nội dung một CV để xem trước hoặc in |
| **UC33** | **CV03** | `POST` | `/api/v1/students/cvs` | Tạo CV mới (mục tiêu, học vấn, kinh nghiệm, kỹ năng, dự án, chứng chỉ) |
| **UC34** | **CV04** | `PATCH` | `/api/v1/students/cvs/:id` | Cập nhật nội dung CV hoặc đánh dấu làm CV mặc định |
| **UC34** | **CV04** | `PATCH` | `/api/v1/students/cvs/:id/default` | Đặt nhanh một CV làm CV mặc định |
| **UC35** | **CV05** | `DELETE` | `/api/v1/students/cvs/:id` | Xóa CV (chỉ cho phép nếu CV không đang gắn với hồ sơ ứng tuyển hoạt động) |

---

### 2.1 Xem danh sách CV (List My CVs — UC31 / CV01)

- **Endpoint:** `GET /api/v1/students/cvs`
- **Yêu cầu xác thực:** Bearer Token (`STUDENT`)
- **Mô tả:** Trả về danh sách tóm tắt toàn bộ CV của sinh viên đang đăng nhập, hiển thị rõ CV nào đang là CV mặc định (`isDefault: true`).

#### Request Header
```http
Authorization: Bearer <accessToken>
```

#### Phản hồi thành công (`200 OK`)
```json
{
  "data": [
    {
      "id": "7b13e9a0-6b68-45e2-8ea5-6b4d326f50b1",
      "title": "CV Lập trình viên Backend (Node.js/NestJS)",
      "isDefault": true,
      "fileUrl": "https://storage.campusjob.vn/cvs/7b13e9a0/cv-backend.pdf",
      "skills": ["TypeScript", "NestJS", "PostgreSQL", "Docker"],
      "createdAt": "2026-10-12T08:00:00.000Z",
      "updatedAt": "2026-10-14T01:30:00.000Z"
    },
    {
      "id": "9c24f8b1-7c79-46f3-9fb6-7c5e437a61c2",
      "title": "CV Kỹ sư Dữ liệu & AI",
      "isDefault": false,
      "fileUrl": null,
      "skills": ["Python", "Pandas", "SQL", "Scikit-Learn"],
      "createdAt": "2026-10-13T10:15:00.000Z",
      "updatedAt": "2026-10-13T10:15:00.000Z"
    }
  ],
  "total": 2
}
```

---

### 2.2 Xem chi tiết CV (Get CV Detail — UC32 / CV02)

- **Endpoint:** `GET /api/v1/students/cvs/:id`
- **Yêu cầu xác thực:** Bearer Token (`STUDENT`)
- **Mô tả:** Lấy thông tin chi tiết đầy đủ của một CV thuộc quyền sở hữu của sinh viên để xem trước giao diện hoặc in ấn/xuất file.

#### Request Header
```http
Authorization: Bearer <accessToken>
```

#### Phản hồi thành công (`200 OK`)
```json
{
  "cv": {
    "id": "7b13e9a0-6b68-45e2-8ea5-6b4d326f50b1",
    "studentId": "e4a2c2b3-5c74-4b53-8d65-1d22dfb43a91",
    "userId": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
    "title": "CV Lập trình viên Backend (Node.js/NestJS)",
    "summary": "Sinh viên năm cuối ngành Kỹ thuật Phần mềm, định hướng phát triển backend hệ thống lớn, RESTful API và cơ sở dữ liệu quan hệ.",
    "isDefault": true,
    "fileUrl": "https://storage.campusjob.vn/cvs/7b13e9a0/cv-backend.pdf",
    "educations": [
      {
        "id": "ed1-5c74-4b53",
        "school": "Đại học Công nghệ Thông tin - ĐHQG TP.HCM",
        "major": "Kỹ thuật Phần mềm",
        "startDate": "2021-09",
        "endDate": "2025-06",
        "isCurrent": true,
        "gpa": "3.52/4.0",
        "description": "Chuyên ngành Công nghệ phần mềm doanh nghiệp, GPA loại giỏi."
      }
    ],
    "experiences": [
      {
        "id": "exp1-8d65-1d22",
        "company": "Công ty Cổ phần Công nghệ ABC",
        "position": "Thực tập sinh Backend",
        "startDate": "2024-06",
        "endDate": "2024-09",
        "isCurrent": false,
        "description": "Xây dựng các API nghiệp vụ bằng NestJS, tối ưu hóa câu truy vấn PostgreSQL, viết unit test đạt 85% coverage."
      }
    ],
    "skills": ["TypeScript", "NestJS", "PostgreSQL", "Docker", "Git", "Redis"],
    "projects": [
      {
        "id": "prj1-6b4d-326f",
        "name": "Hệ thống Quản lý Việc làm Bán thời gian CampusJob",
        "role": "Backend Lead",
        "startDate": "2026-09",
        "endDate": "2026-10",
        "url": "https://github.com/campusjob/core",
        "description": "Kiến trúc Modular Monolith, xác thực JWT kép, kiểm soát RBAC và phân quyền đa vai trò."
      }
    ],
    "certifications": [
      {
        "id": "crt1-7c5e-437a",
        "name": "AWS Certified Cloud Practitioner",
        "issuer": "Amazon Web Services",
        "issueDate": "2024-05",
        "url": "https://aws.amazon.com/verification/example"
      }
    ],
    "createdAt": "2026-10-12T08:00:00.000Z",
    "updatedAt": "2026-10-14T01:30:00.000Z"
  }
}
```

#### Phản hồi lỗi
- `404 Not Found` (Mã lỗi: `CV_NOT_FOUND`): Khi `id` không tồn tại hoặc thuộc về sinh viên khác.

---

### 2.3 Tạo CV mới (Create CV — UC33 / CV03)

- **Endpoint:** `POST /api/v1/students/cvs`
- **Yêu cầu xác thực:** Bearer Token (`STUDENT`)
- **Mô tả:** Tạo CV mới cho sinh viên. Hệ thống tự động gán quyền sở hữu theo sinh viên đang đăng nhập.
- **Quy tắc CV mặc định khi tạo:**
  - Nếu đây là **CV đầu tiên** của sinh viên: Hệ thống tự động gán `isDefault = true` bất kể giá trị gửi lên.
  - Nếu sinh viên đã có CV và gửi `isDefault: true`: Hệ thống đặt CV mới làm mặc định và tự động hủy cờ mặc định của CV cũ trong transaction.
  - Nếu sinh viên đã có CV và không gửi `isDefault` (hoặc gửi `false`): CV mới có `isDefault = false`.
- **Giới hạn số lượng:** Mỗi sinh viên tối đa **10 CV**. Vượt quá sẽ trả về lỗi `CV_LIMIT_EXCEEDED` (HTTP 400).

#### Request Header
```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

#### Request Body (`CreateCvRequestDto`)
| Trường | Kiểu dữ liệu | Bắt buộc | Ràng buộc kiểm thực |
|---|---|---|---|
| `title` | `string` | **Có** | Độ dài 2 - 100 ký tự |
| `summary` | `string` | Không | Tối đa 1000 ký tự |
| `educations` | `EducationItemDto[]` | Không | Tối đa 10 mục học vấn |
| `experiences` | `ExperienceItemDto[]` | Không | Tối đa 10 mục kinh nghiệm |
| `skills` | `string[]` | Không | Tối đa 30 kỹ năng, mỗi kỹ năng tối đa 50 ký tự |
| `projects` | `ProjectItemDto[]` | Không | Tối đa 10 mục dự án |
| `certifications` | `CertificationItemDto[]` | Không | Tối đa 10 mục chứng chỉ |
| `fileUrl` | `string` | Không | Định dạng URL hợp lệ, tối đa 500 ký tự |
| `isDefault` | `boolean` | Không | Giá trị boolean |

*Ví dụ Request Body:*
```json
{
  "title": "CV Lập trình viên Frontend React",
  "summary": "Sinh viên chuyên ngành Kỹ thuật Phần mềm đam mê xây dựng giao diện người dùng hiện đại, chuẩn UI/UX.",
  "isDefault": false,
  "skills": ["TypeScript", "React", "Next.js", "Tailwind CSS"],
  "educations": [
    {
      "school": "Đại học Công nghệ Thông tin - ĐHQG TP.HCM",
      "major": "Kỹ thuật Phần mềm",
      "startDate": "2021-09",
      "endDate": "2025-06",
      "isCurrent": true,
      "gpa": "3.4/4.0"
    }
  ],
  "experiences": [],
  "projects": [
    {
      "name": "E-commerce Web App",
      "role": "Frontend Developer",
      "startDate": "2024-01",
      "endDate": "2024-04",
      "url": "https://github.com/student/e-commerce",
      "description": "Xây dựng website bán hàng chuẩn responsive với Next.js và Tailwind CSS."
    }
  ],
  "certifications": []
}
```

#### Phản hồi thành công (`201 Created`)
```json
{
  "message": "Tạo CV mới thành công.",
  "cv": {
    "id": "3a8c5f21-9d10-48e2-8234-a74d5b290ef4",
    "studentId": "e4a2c2b3-5c74-4b53-8d65-1d22dfb43a91",
    "userId": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
    "title": "CV Lập trình viên Frontend React",
    "summary": "Sinh viên chuyên ngành Kỹ thuật Phần mềm đam mê xây dựng giao diện người dùng hiện đại, chuẩn UI/UX.",
    "isDefault": false,
    "fileUrl": null,
    "educations": [...],
    "experiences": [],
    "skills": ["TypeScript", "React", "Next.js", "Tailwind CSS"],
    "projects": [...],
    "certifications": [],
    "createdAt": "2026-10-14T02:00:00.000Z",
    "updatedAt": "2026-10-14T02:00:00.000Z"
  }
}
```

---

### 2.4 Cập nhật CV (Update CV — UC34 / CV04)

- **Endpoint:** `PATCH /api/v1/students/cvs/:id`
- **Yêu cầu xác thực:** Bearer Token (`STUDENT`)
- **Mô tả:** Chỉnh sửa nội dung thông tin CV hoặc lựa chọn đặt làm CV mặc định.
- **Ràng buộc:** Mọi trường đều là tùy chọn (partial update), chỉ lưu khi dữ liệu gửi lên hợp lệ.
- **Quy tắc CV mặc định khi cập nhật:**
  - Nếu gửi `isDefault: true`: Hệ thống chuyển CV này thành mặc định và tự động hủy cờ mặc định của CV cũ.
  - Nếu CV này đang là **CV mặc định duy nhất** của sinh viên và gửi `isDefault: false`: Hệ thống từ chối với lỗi `CANNOT_UNSET_ONLY_DEFAULT_CV` (HTTP 400), vì sinh viên phải luôn có 1 CV mặc định để phục vụ luồng ứng tuyển nhanh.

#### Request Body (`UpdateCvRequestDto`)
Tương tự `CreateCvRequestDto` nhưng tất cả các trường đều là tùy chọn (optional).

#### Phản hồi thành công (`200 OK`)
```json
{
  "message": "Cập nhật CV thành công.",
  "cv": {
    "id": "3a8c5f21-9d10-48e2-8234-a74d5b290ef4",
    "studentId": "e4a2c2b3-5c74-4b53-8d65-1d22dfb43a91",
    "userId": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
    "title": "CV Lập trình viên Frontend & Mobile React Native",
    "isDefault": true,
    "skills": ["TypeScript", "React", "Next.js", "Tailwind CSS", "React Native"],
    "updatedAt": "2026-10-14T02:15:00.000Z"
  }
}
```

---

### 2.5 Đặt làm CV mặc định (Set Default CV — UC34 / CV04)

- **Endpoint:** `PATCH /api/v1/students/cvs/:id/default`
- **Yêu cầu xác thực:** Bearer Token (`STUDENT`)
- **Mô tả:** Endpoint chuyên dụng giúp giao diện kích hoạt thao tác "Đặt làm CV mặc định" nhanh chóng, an toàn và tường minh.
- **Xử lý giao dịch (Atomic Transaction):** Chuyển CV chỉ định thành `isDefault = true`, đồng thời cập nhật toàn bộ các CV khác của sinh viên thành `isDefault = false`.

#### Request Header
```http
Authorization: Bearer <accessToken>
```

#### Phản hồi thành công (`200 OK`)
```json
{
  "message": "Đã đặt làm CV mặc định thành công.",
  "cvId": "3a8c5f21-9d10-48e2-8234-a74d5b290ef4",
  "isDefault": true
}
```

---

### 2.6 Xóa CV (Delete CV — UC35 / CV05)

- **Endpoint:** `DELETE /api/v1/students/cvs/:id`
- **Yêu cầu xác thực:** Bearer Token (`STUDENT`)
- **Mô tả:** Xóa CV thuộc sở hữu của sinh viên.
- **Ràng buộc nghiệp vụ nghiêm ngặt (UC35 Rule & Contract C-03):**
  - **Từ chối xóa nếu CV đang được sử dụng trong hồ sơ ứng tuyển hoạt động:** Nếu CV này đang liên kết với hồ sơ ứng tuyển ở các trạng thái chưa kết thúc (`SUBMITTED`, `REVIEWING`, `INTERVIEW_SCHEDULED`), hệ thống từ chối xóa và trả về `409 Conflict` kèm mã lỗi `CV_IN_USE_CANNOT_DELETE`.
  - **Bảo toàn tính bất biến của CV mặc định:** Nếu sinh viên xóa CV đang là CV mặc định và vẫn còn các CV khác, hệ thống sẽ tự động gán quyền mặc định cho CV được cập nhật gần nhất còn lại, đảm bảo nguyên tắc bất biến (Default CV Invariant).

#### Request Header
```http
Authorization: Bearer <accessToken>
```

#### Phản hồi thành công (`200 OK`)
```json
{
  "message": "Xóa CV thành công.",
  "deletedCvId": "3a8c5f21-9d10-48e2-8234-a74d5b290ef4"
}
```

#### Phản hồi lỗi vi phạm ràng buộc (`409 Conflict`)
```json
{
  "statusCode": 409,
  "message": "Không thể xóa CV đang được sử dụng trong hồ sơ ứng tuyển đang hoạt động.",
  "error": "Conflict",
  "code": "CV_IN_USE_CANNOT_DELETE",
  "timestamp": "2026-10-14T02:00:00.000Z",
  "path": "/api/v1/students/cvs/3a8c5f21-9d10-48e2-8234-a74d5b290ef4"
}
```

---

## 3. Quy chuẩn tích hợp liên module (Cross-Module Contracts)

### 3.1 Contract C-03: M02 (CV) → M04 (Application) — Nộp hồ sơ bằng CV Snapshot (UC38 / UC37)
- **Vấn đề cần giải quyết:** Khi sinh viên nộp CV vào tin tuyển dụng (UC38), nếu sinh viên sửa hoặc xóa CV gốc trong M02 sau đó, hồ sơ nhà tuyển dụng đang xem (UC37) không được phép bị thay đổi hoặc mất dữ liệu.
- **Giải pháp chuẩn hóa (Snapshot First):**
  - Khi sinh viên nộp hồ sơ, M04 gọi dịch vụ nội bộ của M02 để trích xuất `CvSnapshotDto`.
  - Dữ liệu `CvSnapshotDto` được serialize và lưu trữ vĩnh viễn (immutable snapshot) trong bản ghi `Application` của Module M04.
  - Cấu trúc `CvSnapshotDto` được đóng gói độc lập bao gồm cả thông tin sinh viên tại thời điểm nộp (họ tên, email, số điện thoại, tiêu đề, học vấn, kinh nghiệm, kỹ năng, dự án, chứng chỉ, tệp đính kèm).

### 3.2 Contract C-04: M03 (Employer & Job) ← M02 (CV & Profile) — Quyền riêng tư & Hiển thị an toàn
- Nhà tuyển dụng duyệt tin tuyển dụng chỉ được xem nội dung CV của sinh viên khi sinh viên đã chủ động nộp hồ sơ vào tin tuyển dụng thuộc doanh nghiệp đó (thông qua `CvSnapshot` của M04).
- Nhà tuyển dụng **không có quyền** gọi trực tiếp các endpoint `GET /students/cvs` hay `GET /students/cvs/:id` của M02 (bị chặn 403 Forbidden bởi `RolesGuard(STUDENT)`).

### 3.3 Contract C-05: M01 (Account) ← M02 (CV & Profile) — Xác thực quyền sở hữu
- Định danh `userId` luôn được giải mã từ JWT token (`req.user.id`).
- Module M02 gọi `User` entity qua khóa ngoại `userId` để xác thực trạng thái tài khoản `ACTIVE` trước khi cho phép thao tác CV.
