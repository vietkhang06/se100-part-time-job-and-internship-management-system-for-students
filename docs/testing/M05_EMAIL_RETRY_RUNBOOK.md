# M05 Runbook — Email Retry Scheduler & Mailpit/SMTP Operations

> **Nhiệm vụ:** R-M05-03 (Sprint 9 — Khắc phục) / S6-M05-04  
> **Hợp đồng liên quan:** C-11, C-20  
> **Module:** M05 — Moderation, Review, Report & Notification  
> **Người thực hiện:** Minh Phương | **Reviewer:** Gia Khang  

---

## 1. Mục tiêu và phạm vi

Runbook này hướng dẫn cấu hình, vận hành và kiểm thử hệ thống lập lịch thử lại email thông báo (Email Retry Scheduler) và dịch vụ Mailpit/SMTP trong CampusJob:
1. **Lập lịch tự động an toàn:** `EmailRetrySchedulerService` định kỳ kích hoạt `RetryPendingNotificationEmailsUseCase` (chu kỳ 60 giây) để quét và gửi các email `PENDING` hoặc `FAILED` đã đến hạn thử lại.
2. **Khử trùng lặp & Chống chạy đè (Overlapping Safe):**
   - Tầng scheduler sử dụng cờ `isRunning` để bỏ qua các lần kích hoạt trùng khi chu kỳ trước chưa kết thúc (`SKIPPED_OVERLAPPING`).
   - Tầng persistence sử dụng cơ chế lease 5 phút (`claimForEmailDispatch`) và cập nhật nguyên tử `emailNextRetryAt` để bảo đảm hai worker/process không bao giờ gửi cùng một email.
3. **Bảo toàn thông báo trong ứng dụng:** Lỗi SMTP (timeout, mất kết nối, từ chối kết nối) tuyệt đối không làm mất bản ghi `Notification` trong cơ sở dữ liệu.
4. **Chiến lược lũy tiến (Exponential Backoff):** Thất bại lần 1, 2, 3, 4 lần lượt dời thời gian thử lại sau 1, 5, 15, 60 phút. Sau tối đa 5 lần thử (kể cả lần đầu), trạng thái dừng vĩnh viễn ở `FAILED` với `emailNextRetryAt = null`.
5. **Vận hành Mailpit:** Sử dụng Mailpit làm máy chủ giả lập SMTP cục bộ cho dev và CI, trực quan hóa email qua giao diện Web UI tại cổng `8026`.

---

## 2. Kiến trúc & Vòng đời dịch vụ

### 2.1 Thành phần tham gia

```
[EmailRetrySchedulerService]
       │ (Mỗi 60s qua setInterval / OnModuleInit)
       ▼
[RetryPendingNotificationEmailsUseCase]
       │
       ├─► [PrismaNotificationRepository.findEmailDispatchable(now, limit=50, maxAttempts=5)]
       │
       └─► Lặp từng ứng viên: [DispatchNotificationEmailUseCase.execute(id, now)]
                  │
                  ├─► [PrismaNotificationRepository.claimForEmailDispatch(id, now, lease5Min)]
                  ├─► [NodemailerNotificationEmailSender.send(message)]
                  │         │
                  │         ├─► [SMTP / Mailpit: localhost:1026]
                  │
                  ├─► Thành công: markEmailSent(id, now) -> SENT
                  └─► Thất bại: markEmailFailed(id, attempts, error, nextRetryAt) -> FAILED
```

### 2.2 Vòng đời ứng dụng (Lifecycle Management)
- **Khởi động (`onModuleInit`):** Timer được đăng ký với `setInterval` theo `EMAIL_RETRY_INTERVAL_MS` (mặc định 60,000 ms). Timer được gọi `unref()` để không giữ tiến trình Node.js khi chạy các tác vụ CLI hoặc test runner. Không thực hiện query DB đồng bộ trong lúc khởi tạo module.
- **Hủy (`onModuleDestroy`):** Gọi `clearInterval(this.timer)` để xóa triệt để background timer, ngăn rò rỉ bộ nhớ hoặc open handles trong môi trường test/reload.

---

## 3. Cấu hình môi trường (Environment Variables)

Các biến môi trường được định nghĩa trong `.env` và `.env.example`:

| Biến môi trường | Giá trị mặc định | Ý nghĩa |
|---|---|---|
| `SMTP_HOST` | `localhost` | Máy chủ SMTP (Mailpit khi chạy local/Docker) |
| `SMTP_PORT` | `1026` | Cổng SMTP (Mailpit ánh xạ cổng 1025 của container sang 1026 trên host) |
| `SMTP_FROM` | `no-reply@campusjob.local` | Địa chỉ gửi hiển thị của email hệ thống |
| `MAILPIT_WEB_PORT` | `8026` | Cổng giao diện Web UI của Mailpit |
| `SMTP_USER` | *(trống)* | Tùy chọn: Tài khoản xác thực SMTP (nếu dùng SMTP ngoài) |
| `SMTP_PASS` | *(trống)* | Tùy chọn: Mật khẩu xác thực SMTP |
| `SMTP_SECURE` | `false` | `true` nếu dùng TLS/SSL ngay từ đầu (cổng 465), `false` cho STARTTLS/Plain |
| `SMTP_IGNORE_TLS` | `true` | Bỏ qua kiểm tra chứng chỉ TLS tự ký của Mailpit |
| `ENABLE_EMAIL_RETRY_SCHEDULER` | `true` | Bật/tắt background scheduler (`false` để tắt trong một số bộ test) |
| `EMAIL_RETRY_INTERVAL_MS` | `60000` | Chu kỳ kích hoạt retry scheduler (ms) — mặc định 60 giây |
| `EMAIL_RETRY_BATCH_LIMIT` | `50` | Giới hạn số lượng email xử lý trong một lần quét |

---

## 4. Hướng dẫn vận hành Mailpit cục bộ

### 4.1 Khởi động Mailpit qua Docker Compose

```powershell
# Khởi động dịch vụ PostgreSQL và Mailpit
docker compose --env-file .env -f infra/docker-compose.yml up -d mailpit

# Kiểm tra trạng thái container Mailpit
docker compose --env-file .env -f infra/docker-compose.yml ps mailpit
```

Container Mailpit sẽ lắng nghe tại:
- **SMTP Port:** `127.0.0.1:1026` (Backend gửi thư vào đây)
- **Web UI:** `http://localhost:8026` (Mở trình duyệt xem hộp thư đến)

### 4.2 Dừng / Khởi động lại dịch vụ Mailpit

```powershell
# Dừng Mailpit để giả lập sự cố SMTP offline
docker compose --env-file .env -f infra/docker-compose.yml stop mailpit

# Khởi động lại Mailpit để kiểm tra khả năng tự phục hồi (Recovery)
docker compose --env-file .env -f infra/docker-compose.yml start mailpit
```

---

## 5. Quy trình xác thực thủ công (Manual Validation Scenarios)

### Kịch bản 1: Gửi thành công trong điều kiện bình thường (Happy Path)
1. Đảm bảo Mailpit đang chạy: `http://localhost:8026`.
2. Tạo một thông báo có yêu cầu gửi email (ví dụ: `JOB_APPROVED`, `APPLICATION_STATUS_CHANGED`).
3. Kiểm tra DB: Bản ghi `Notification` có `emailStatus = 'SENT'`, `emailAttempts = 1`, `emailSentAt` được cập nhật.
4. Mở Mailpit Web UI (`http://localhost:8026`), xác nhận email xuất hiện với tiêu đề `CampusJob — [Tiêu đề]` và nội dung đúng người nhận.

### Kịch bản 2: SMTP Offline & Lưu giữ thông báo in-app
1. Dừng Mailpit: `docker compose -f infra/docker-compose.yml stop mailpit`.
2. Phát sự kiện thông báo (ví dụ duyệt tin hoặc ứng tuyển).
3. Quan sát log backend:
   ```
   [DispatchNotificationEmailUseCase] Email for notification <ID> failed (attempt 1): connect ECONNREFUSED 127.0.0.1:1026
   ```
4. Kiểm tra DB:
   - Bản ghi `Notification` vẫn tồn tại nguyên vẹn (in-app notification không bị xóa).
   - `emailStatus` = `'FAILED'`.
   - `emailAttempts` = `1`.
   - `emailNextRetryAt` = `now + 1 phút`.
   - `emailLastError` chứa thông tin lỗi kết nối.

### Kịch bản 3: Tự động phục hồi & Retry qua Scheduler (Recovery)
1. Sau khi ghi nhận trạng thái `FAILED`, khởi động lại Mailpit:
   ```powershell
   docker compose -f infra/docker-compose.yml start mailpit
   ```
2. Chờ 60 giây để scheduler kích hoạt chu kỳ kế tiếp.
3. Quan sát log backend:
   ```
   [EmailRetrySchedulerService] Starting email retry run.
   [EmailRetrySchedulerService] Completed email retry run: picked=1, sent=1, failed=0, skipped=0.
   ```
4. Kiểm tra DB:
   - `emailStatus` chuyển sang `'SENT'`.
   - `emailSentAt` được cập nhật thời điểm hiện tại.
   - `emailNextRetryAt` được xóa về `null`.
5. Mở Mailpit Web UI (`http://localhost:8026`), xác nhận email đã được nhận đầy đủ.

### Kịch bản 4: Hết lượt thử lại tối đa (Dead-letter Terminal State)
1. Giữ Mailpit offline trong hơn 5 chu kỳ retry.
2. Lần lượt sau các mốc 1 phút, 5 phút, 15 phút, 60 phút, hệ thống tăng dần `emailAttempts`.
3. Khi `emailAttempts` đạt `5`:
   - `computeNextRetryAt(5, now)` trả về `null`.
   - `emailNextRetryAt` được đặt là `null`.
   - `emailStatus` giữ trạng thái `FAILED` vĩnh viễn, không tiếp tục quét lại trong các chu kỳ sau.
