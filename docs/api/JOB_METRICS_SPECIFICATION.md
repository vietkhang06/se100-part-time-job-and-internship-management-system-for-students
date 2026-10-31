# Quy chuẩn Đo lường Lượt xem, Lượt lưu và Lịch trình Tin tuyển dụng (Job Metrics & Expiry Specification)

Tài liệu kỹ thuật quy định các nguyên tắc tính toán số liệu (`viewCount`, `saveCount`), cơ chế khử trùng lặp (deduplication), kiểm soát quyền truy cập và cơ chế tự động đóng / nhắc nhở tin hết hạn cho Module 3 (Doanh nghiệp & Tuyển dụng) theo các tiêu chuẩn S6-M03-01, S6-M03-02 và Hợp đồng C-07, C-09, C-11.

---

## 1. Quy tắc Tính Lượt xem Tin tuyển dụng (`viewCount`)

### 1.1. Điều kiện kích hoạt (Trigger Condition)
- Lượt xem chỉ được ghi nhận khi có yêu cầu truy vấn chi tiết tin tuyển dụng công khai thành công (`GET /api/v1/jobs/:id`).
- Tin tuyển dụng phải thỏa mãn **Shared Visibility Predicate**:
  - Trạng thái `status === OPEN`.
  - Hạn nộp `deadline > now` (chưa hết hạn).
  - Cờ kiểm duyệt `hiddenByModeration === false`.
  - Doanh nghiệp sở hữu có `verificationStatus === VERIFIED`.
- Nếu tin không thỏa mãn điều kiện công khai (hoặc không tồn tại), hệ thống trả về 404 và **tuyệt đối không ghi nhận lượt xem**.

### 1.2. Khử trùng lặp theo Ngày và Định danh Người xem (Deduplication Rule)
- Mỗi người xem chỉ được tính tối đa **1 lượt xem cho 1 tin tuyển dụng trong 1 ngày dương lịch (UTC Calendar Day, `YYYY-MM-DD`)**.
- Định danh người xem (`viewerKey`) được xác định theo nguyên tắc:
  - **Người dùng đã đăng nhập (Authenticated)**: Sử dụng tiền tố `user:<userId>`.
  - **Khách vãng lai (Anonymous / Unauthenticated)**: Băm mã bảo mật SHA-256 từ secret salt trên server (`VIEW_HASH_SALT`), địa chỉ IP và chuỗi User-Agent:
    `anon:sha256(VIEW_HASH_SALT + "|" + ip + "|" + userAgent).substring(0, 32)`
    *Lưu ý bảo mật*: hashed, salted, pending privacy review (bắt buộc cấu hình `VIEW_HASH_SALT` trên production).
- Khử trùng lặp được đảm bảo bền vững tại tầng cơ sở dữ liệu thông qua ràng buộc duy nhất trên bảng `JobViewLog`:
  `@@unique([jobId, viewerKey, viewDate])`
- Nếu cùng một người xem làm mới trang (refresh) hoặc thử lại yêu cầu (retry) nhiều lần trong cùng một ngày, hệ thống chặn duplicate tại DB (bắt mã lỗi `P2002`) và **không tăng số đếm lần hai**.
- Sang ngày dương lịch tiếp theo (`viewDate` mới), lượt xem của người dùng đó sẽ được tính lại 1 lần nếu tiếp tục truy cập.

### 1.3. Tính nguyên tử (Atomicity)
- Thao tác ghi nhận bản ghi `JobViewLog` và tăng trường `JobPosting.viewCount` (`increment: 1`) được thực hiện bên trong cùng một Database Transaction.

### 1.4. Loại trừ Lượt xem Nội bộ (Owner Views Exclusion)
- Nếu người truy vấn tin là thành viên đang hoạt động (`CompanyMemberStatus.ACTIVE`) hoặc Chủ sở hữu (`OWNER`) của doanh nghiệp đăng tin đó, hệ thống nhận diện đây là lượt xem nội bộ và **tuyệt đối không ghi nhận / không tăng `viewCount`**.

---

## 2. Quy tắc Tính Lượt lưu Tin tuyển dụng (`saveCount`)

### 2.1. Bản chất số liệu (Derived Counter)
- Số lượt lưu `saveCount` là một số liệu suy diễn (derived metric), được tính toán động bằng cách đếm số dòng liên kết hợp lệ trong bảng `SavedJob`:
  `saveCount = COUNT(SavedJob WHERE jobId = :jobId)`
- Không lưu biến đếm tĩnh trong bảng `JobPosting` để tránh sai lệch dữ liệu khi sinh viên lưu / bỏ lưu tin, đảm bảo tính nhất quán tuyệt đối và đối soát khớp 100% với dữ liệu thực tế trong DB.

### 2.2. Tính độc lập của Sinh viên (Tenant Isolation)
- Mỗi sinh viên chỉ có thể lưu một tin tuyển dụng đúng một lần (`@@unique([studentId, jobId])`).
- Sinh viên chỉ được phép xem và thao tác trên danh sách tin đã lưu của chính mình.
- Bỏ lưu (`DELETE`) chỉ gỡ liên kết của người dùng hiện tại, không ảnh hưởng đến số đếm của người khác.

---

## 3. Phân quyền và Bảo mật Số liệu (Metrics Access Control)

| Đối tượng / Endpoint | Quyền hạn hiển thị | Ghi chú bảo mật |
|---|---|---|
| **Công khai (Public)**<br>`GET /jobs`, `GET /jobs/:id` | **KHÔNG** hiển thị `viewCount`, **KHÔNG** hiển thị `saveCount` | DTO công khai (`PublicJobPostingDto`) loại trừ toàn bộ số liệu thống kê để bảo mật kinh doanh cho doanh nghiệp. |
| **Nhà tuyển dụng (Employer)**<br>`GET /employer/jobs`, `GET /employer/jobs/:id` | Hiển thị `viewCount` và `saveCount` của các tin thuộc doanh nghiệp mình quản lý | Chặn truy cập tin của doanh nghiệp khác (403 Forbidden). |
| **Quản trị viên (Admin)**<br>`GET /admin/jobs/metrics`, `GET /admin/jobs/:jobId/metrics` | Hiển thị tổng hợp toàn hệ sinh thái và chi tiết từng tin | Yêu cầu vai trò `UserRole.ADMIN`. |

---

## 4. Tự động Đóng Tin Hết hạn & Nhắc nhở Trước 3 Ngày (Scheduler Rule - S6-M03-02)

### 4.1. Bước 1: Tự động đóng tin hết hạn (Auto-close)
- Tiến trình định kỳ quét toàn bộ các tin tuyển dụng có `status !== 'CLOSED'` và `deadline < now`.
- Cập nhật trạng thái sang `CLOSED`.
- Thao tác thực hiện theo khối điều kiện nguyên tử, đảm bảo tính bền vững (persisted) và không rollback.

### 4.2. Bước 2: Gửi thông báo nhắc nhở trước 3 ngày (3-Day Reminder)
- Quét các tin có `status === 'OPEN'` và thời hạn rơi vào khoảng:
  `now < deadline <= now + 3 ngày`
- Xác định người nhận thuộc doanh nghiệp sở hữu tin:
  1. Ưu tiên gửi cho tất cả thành viên có vai trò `OWNER` và trạng thái `ACTIVE`.
  2. Nếu doanh nghiệp không có Owner khả dụng, gửi cho toàn bộ thành viên đang `ACTIVE`.
- Khử trùng lặp gửi thư (Deduplication):
  - Ghi nhận bản ghi gửi thư vào bảng `JobExpiryReminderLog` với khóa duy nhất:
    `@@unique([jobId, recipientId, deadlineDate])`
  - Nếu đã có bản ghi trong ngày hạn đó, tiến trình bỏ qua không gửi lại.
- Xử lý lỗi an toàn (Fail-safe):
  - Lỗi gửi email (SMTP lỗi, mạng ngắt quãng) được bắt lại và ghi log kèm **Correlation ID**.
  - Lỗi email **không** ghi bản ghi vào `JobExpiryReminderLog` (để tiến trình tiếp theo tự động retry gửi lại).
  - Lỗi email **không bao giờ** làm gián đoạn hay rollback Bước 1 (đóng tin hết hạn).
