# MA TRẬN KIỂM THỬ TÍCH HỢP PHÂN HỆ M02 (M02 INTEGRATION TEST MATRIX)

Tài liệu này xác định ma trận kiểm thử tích hợp chính thức cho nhiệm vụ **S2-M02-06**, đóng vai trò nguồn chân lý (Single Source of Truth) giữa Phân hệ **M02 (Student Profile & CV)** với **M01 (Auth & RBAC)** và **M04 (Application & Interview)**.

- **Mã nhiệm vụ:** S2-M02-06 — M02 Integration Test (UC11–UC12, UC31–UC35)
- **Phân hệ bao phủ:**
  - `M02` (Student Profile & CV Management)
  - `M01` (Account, Session & RBAC Integration)
  - `M04` (Application Submission & Snapshot Consumption)
- **Hợp đồng quy chiếu:**
  - **C-01 / C-02 (Auth & RBAC):** Xác thực JWT, cấu trúc `AuthContext`, kiểm soát truy cập `@Roles(UserRole.STUDENT)`, từ chối vai trò khác (`FORBIDDEN`).
  - **C-03 (CV → Application Integration):** Port `CvSnapshotSource`, DTO `CvSnapshotDto`, trích xuất snapshot bất biến cho UC38 và UC37.
  - **C-04 (CV API & Privacy):** Quyền riêng tư của CV (chặn Employer gọi trực tiếp CV API), giới hạn tối đa 5 CV (`CV_LIMIT_EXCEEDED`), quy tắc cờ mặc định.
  - **C-05 (Student Profile & Anti-IDOR):** Trích xuất `userId` từ token, cấm tuyệt đối truy cập chéo dữ liệu giữa các sinh viên, ném `404 Not Found` (`CV_NOT_FOUND`).
- **Tiêu chí nghiệm thu cốt lõi (Acceptance Criteria):**
  1. *Không truy cập chéo dữ liệu:* Sinh viên A không thể đọc/sửa/xóa/snapshot CV của Sinh viên B (Anti-IDOR `404 Not Found`).
  2. *Auth Context truyền đúng:* Định danh người dùng luôn lấy từ JWT token (`req.user`), không tin cậy client params.
  3. *Luồng CV → Application chạy đúng:* Sinh viên tạo CV $\rightarrow$ Nộp đơn (M04 chụp snapshot qua C-03) $\rightarrow$ CV gốc thay đổi hoặc bị xóa $\rightarrow$ Đơn ứng tuyển trong M04 vẫn bảo toàn snapshot ban đầu (Immutability).

---

## 1. Danh mục Ca kiểm thử Tích hợp (20 Test Cases)

| Mã Case | Ca sử dụng / Luồng | Phương thức & Tuyến đường | Tác nhân / Vai trò | Bối cảnh kiểm thử | Kết quả mong đợi | Hợp đồng quy chiếu |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| **INT-01** | UC31 (Danh sách CV) | `GET /api/v1/students/cvs` | Khách vãng lai | Chưa đăng nhập (Không gửi Bearer token) | `401 Unauthorized` | C-01 |
| **INT-02** | UC31 (Danh sách CV) | `GET /api/v1/students/cvs` | Employer | Đăng nhập với vai trò `EMPLOYER` | `403 Forbidden` (`FORBIDDEN`) | C-02, C-04 |
| **INT-03** | UC31 (Danh sách CV) | `GET /api/v1/students/cvs` | Moderator | Đăng nhập với vai trò `MODERATOR` | `403 Forbidden` (`FORBIDDEN`) | C-02 |
| **INT-04** | UC31 (Danh sách CV) | `GET /api/v1/students/cvs` | Admin | Đăng nhập với vai trò `ADMIN` | `403 Forbidden` (`FORBIDDEN`) | C-02 |
| **INT-05** | UC11 (Xem Profile) | `GET /api/v1/students/profile` | Student A | Tài khoản bị đình chỉ (`SUSPENDED`) | `403 Forbidden` (`ACCOUNT_SUSPENDED`) | C-01 |
| **INT-06** | UC12 (Sửa Profile) | `PATCH /api/v1/students/profile` | Student A | Tài khoản bị khóa tạm thời (`LOCKED`) | `403 Forbidden` (`ACCOUNT_LOCKED`) | C-01 |
| **INT-07** | UC11, UC12 (Profile) | `GET & PATCH /api/v1/students/profile` | Student A (Active) | Sinh viên cập nhật học vấn & kỹ năng | `200 OK`, AuthContext ánh xạ đúng hồ sơ | C-01, C-05 |
| **INT-08** | UC33 (Tạo CV) | `POST /api/v1/students/cvs` | Student A | Tạo CV đầu tiên (tự động nhận `isDefault: true`) | `201 Created`, CV gán đúng profile A | C-04, C-05 |
| **INT-09** | UC31 (Danh sách CV) | `GET /api/v1/students/cvs` | Student A | Sinh viên A chỉ thấy đúng các CV của mình | `200 OK`, không thấy CV của Sinh viên B | C-05 |
| **INT-10** | UC32 (Xem chi tiết CV) | `GET /api/v1/students/cvs/:id` | Student B | Sinh viên B cố xem `cvId` của Sinh viên A | `404 Not Found` (`CV_NOT_FOUND`) | C-05 (Anti-IDOR) |
| **INT-11** | UC34 (Chỉnh sửa CV) | `PATCH /api/v1/students/cvs/:id` | Student B | Sinh viên B cố sửa nội dung CV của Sinh viên A | `404 Not Found` (`CV_NOT_FOUND`) | C-05 (Anti-IDOR) |
| **INT-12** | UC35 (Đặt mặc định) | `PATCH /api/v1/students/cvs/:id/default` | Student B | Sinh viên B cố đổi cờ default CV của Sinh viên A | `404 Not Found` (`CV_NOT_FOUND`) | C-05 (Anti-IDOR) |
| **INT-13** | UC35 (Xóa CV) | `DELETE /api/v1/students/cvs/:id` | Student B | Sinh viên B cố xóa CV của Sinh viên A | `404 Not Found` (`CV_NOT_FOUND`) | C-05 (Anti-IDOR) |
| **INT-14** | UC38 (Snapshot Anti-IDOR)| `GET /api/v1/students/cvs/:id/snapshot` | Student B | Sinh viên B cố chụp snapshot CV của Sinh viên A | `404 Not Found` (`CV_NOT_FOUND`) | C-03, C-05 |
| **INT-15** | UC35 (Quy tắc Default) | `PATCH /api/v1/students/cvs/:id2/default` | Student A | Đặt CV2 làm mặc định $\rightarrow$ CV1 tự động bỏ mặc định | `200 OK`, duy nhất 1 CV default | C-04 |
| **INT-16** | UC33 (Giới hạn số lượng)| `POST /api/v1/students/cvs` | Student A | Tạo vượt quá 10 CV trên cùng một tài khoản | `400 Bad Request` (`CV_LIMIT_EXCEEDED`) | C-04 |
| **INT-17** | UC38 (M02 $\rightarrow$ M04 Apply)| `POST /api/v1/jobs/:jobId/apply` | Student A | Nộp đơn ứng tuyển với CV chính chủ hợp lệ | `201 Created`, M04 lưu snapshot CV đầy đủ | C-03 |
| **INT-18** | UC38 (M04 Chống IDOR) | `POST /api/v1/jobs/:jobId/apply` | Student A | Sinh viên A nộp đơn nhưng truyền `cvId` của Sinh viên B | `404 Not Found` / `403 Forbidden` (Bị chặn) | C-03, C-05 |
| **INT-19** | UC37 (Tính bất biến - Sửa)| `PATCH /api/v1/students/cvs/:id` | Student A | Sinh viên sửa CV gốc sau khi đã nộp đơn | `200 OK`, nhưng Snapshot trong đơn không đổi | C-03 (Immutability) |
| **INT-20** | UC37 (Tính bất biến - Xóa)| `DELETE /api/v1/students/cvs/:id` | Student A | Sinh viên xóa CV gốc sau khi nộp đơn | `200 OK`, đơn ứng tuyển vẫn giữ nguyên snapshot | C-03 (Immutability) |

---

## 2. Kiến trúc Thực thi Bộ Kiểm thử Tích hợp

Bộ kiểm thử được tổ chức tại `apps/api/test/m02-integration.e2e-spec.ts`:
1. **Môi trường:**
   - Kết nối cơ sở dữ liệu PostgreSQL thực tế (Port 5435).
   - Tự động sinh dữ liệu kiểm thử (Fixtures) cô lập hoàn toàn giữa các ca kiểm thử: Sinh viên A, Sinh viên B, Nhà tuyển dụng, Quản trị viên, Kiểm duyệt viên.
2. **Khởi tạo và cấu hình ứng dụng:**
   - Đăng ký đầy đủ `AppModule`, bảo đảm các Guard (`JwtAuthGuard`, `RolesGuard`), Interceptor, và Filter hoạt động đúng như môi trường sản xuất.
   - Sử dụng `CvSnapshotSource` adapter thực tế kết nối trực tiếp giữa Module M02 và M04 Workflow.
3. **Tiêu chuẩn dọn dẹp (Teardown):**
   - Làm sạch toàn bộ dữ liệu đơn ứng tuyển, CV, profile, sessions, và users sau khi kết thúc suite test, không để lại dữ liệu rác.
