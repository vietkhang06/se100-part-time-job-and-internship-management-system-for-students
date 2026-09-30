# CAMPUSJOB — VAI TRÒ VÀ MÁY TRẠNG THÁI (ROLES & STATE MACHINES)

## I. CÁC VAI TRÒ HỆ THỐNG (SYSTEM ROLES)

| Vai trò (Role) | Mô tả | Quyền hạn chính |
|---|---|---|
| `STUDENT` | Sinh viên đang theo học hoặc mới tốt nghiệp | Tìm kiếm việc làm, quản lý CV cá nhân, xác thực email trường, ứng tuyển, quản lý lịch phỏng vấn, đánh giá công ty. |
| `EMPLOYER` | Nhà tuyển dụng, đại diện pháp lý của doanh nghiệp | Quản lý thông tin công ty, chi nhánh, đăng tin tuyển dụng, xem CV snapshot của ứng viên, cập nhật trạng thái ứng tuyển, lên lịch phỏng vấn. |
| `MODERATOR` | Kiểm duyệt viên (Ban cán sự trường / Quản trị nội dung) | Thẩm định và duyệt hồ sơ doanh nghiệp mới, duyệt tin tuyển dụng trước khi công khai, xử lý báo cáo vi phạm từ người dùng. |
| `ADMIN` | Quản trị viên cấp cao nhất | Toàn quyền kiểm soát hệ thống, quản lý người dùng, phân quyền, xem audit log, kích hoạt chế độ bảo trì, cấu hình thông số. |

---

## II. MÁY TRẠNG THÁI (STATE MACHINES)

### 1. Trạng thái người dùng (`UserStatus`)
```mermaid
stateDiagram-v2
    [*] --> PENDING_VERIFICATION : Đăng ký thành công
    PENDING_VERIFICATION --> ACTIVE : Xác minh email qua token
    ACTIVE --> SUSPENDED : Bị tạm khóa do vi phạm (Moderator/Admin)
    SUSPENDED --> ACTIVE : Mở khóa sau khi giải trình
    ACTIVE --> LOCKED : Bị khóa vĩnh viễn (Admin)
    SUSPENDED --> LOCKED : Vi phạm nghiêm trọng
    LOCKED --> [*]
```

### 2. Trạng thái hồ sơ ứng tuyển (`ApplicationStatus`)
```mermaid
stateDiagram-v2
    [*] --> SUBMITTED : Sinh viên nộp CV Snapshot
    SUBMITTED --> REVIEWING : Nhà tuyển dụng mở xem hồ sơ
    REVIEWING --> INTERVIEW_SCHEDULED : Đặt lịch phỏng vấn
    INTERVIEW_SCHEDULED --> ACCEPTED : Trúng tuyển / Nhận việc
    INTERVIEW_SCHEDULED --> REJECTED : Không đạt phỏng vấn
    REVIEWING --> REJECTED : Không phù hợp hồ sơ
    SUBMITTED --> WITHDRAWN : Sinh viên tự rút hồ sơ
    ACCEPTED --> [*]
    REJECTED --> [*]
    WITHDRAWN --> [*]
```

### 3. Trạng thái tin tuyển dụng (`JobStatus`)
```mermaid
stateDiagram-v2
    [*] --> DRAFT : Doanh nghiệp soạn thảo
    DRAFT --> PENDING_APPROVAL : Gửi yêu cầu duyệt
    PENDING_APPROVAL --> PUBLISHED : Kiểm duyệt viên chấp thuận
    PENDING_APPROVAL --> REJECTED_BY_MOD : Kiểm duyệt viên từ chối
    REJECTED_BY_MOD --> DRAFT : Doanh nghiệp chỉnh sửa lại
    PUBLISHED --> CLOSED : Hết hạn hoặc đủ số lượng
    PUBLISHED --> ARCHIVED : Doanh nghiệp lưu trữ
    PUBLISHED --> SUSPENDED_BY_MOD : Bị khóa do có báo cáo vi phạm
```
