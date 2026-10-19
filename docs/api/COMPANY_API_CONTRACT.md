# CAMPUSJOB — TÀI LIỆU HỢP ĐỒNG API DOANH NGHIỆP & CHI NHÁNH (COMPANY & BRANCH API CONTRACT)

Tài liệu này xác định quy chuẩn API RESTful, quy tắc xác thực hồ sơ và quản lý chi nhánh cho phân hệ Doanh nghiệp (`S2-M03-01` & `S2-M03-02`).

---

## 1. Phân quyền & Kiểm soát truy cập (RBAC & Tenant Isolation)

- **Vai trò cho phép:**
  - `GET /api/v1/companies/profile`: Dành riêng cho `EMPLOYER`.
  - `PATCH /api/v1/companies/profile`: Dành riêng cho `EMPLOYER` có quyền quản lý (`OWNER`, `ADMIN`, `HR_MANAGER`).
  - `POST /api/v1/companies`: Khởi tạo công ty cho `EMPLOYER`.
  - `PATCH /api/v1/companies/:id`: Cập nhật theo `id`, kiểm tra tenant nghiêm ngặt (người dùng chỉ được sửa công ty của mình).
  - `PATCH /api/v1/companies/:id/verification-status`: Dành riêng cho `MODERATOR` và `ADMIN`.
  - Tuyến chi nhánh (`/api/v1/companies/branches*`): Dành cho `EMPLOYER` của chính doanh nghiệp. Không cho phép truy cập, sửa hoặc xóa chi nhánh thuộc doanh nghiệp khác.

---

## 2. Máy trạng thái xác thực doanh nghiệp (Verification Lifecycle)

Các trạng thái nghiệp vụ:
- `PENDING_REVIEW`: Chờ xác thực (sau khi doanh nghiệp khởi tạo hoặc nộp lại yêu cầu).
- `VERIFIED`: Đang hoạt động / Đã xác thực (được cấp phép bởi Moderator/Admin).
- `REJECTED`: Bị từ chối (bắt buộc kèm theo `rejectionReason`).

### Quy tắc bất biến:
1. Thao tác cập nhật hồ sơ thông thường (`PATCH /companies/profile`) tuyệt đối **không tự động kích hoạt** trạng thái xác thực.
2. Một công ty đang ở trạng thái `REJECTED` khi cập nhật thông tin thông thường vẫn giữ nguyên trạng thái `REJECTED`.
3. Chỉ quy trình kiểm duyệt chính thức của Moderator/Admin mới được phép chuyển đổi trạng thái xác thực.

---

## 3. Ràng buộc toàn vẹn xóa chi nhánh (Branch Deletion Integrity - AC 5.5)

- Tuyệt đối **không xóa chi nhánh đang được gắn với tin tuyển dụng**.
- Khi gửi yêu cầu `DELETE /api/v1/companies/branches/:id`, hệ thống kiểm tra qua `ICompanyBranchRepository.isBranchInUse` và `IJobBranchUsageChecker`:
  - Nếu chi nhánh đang được tham chiếu bởi bất kỳ tin tuyển dụng nào: Trả về `409 Conflict` với mã lỗi `BRANCH_IN_USE_CANNOT_DELETE`.
  - Nếu chi nhánh không bị ràng buộc: Cho phép xóa an toàn và trả về `200 OK`.
