# C-20 — Notification Contract (M05) — DRAFT

> Trạng thái: **DRAFT**, chờ Lead và Owner M03/M04 xác nhận payload.
> Owner: Minh Phương (M05). Task: S2-M05-05. UC: UC62, UC63.

## 1. Cho module khác phát sự kiện (in-process)

Inject `NOTIFICATION_PUBLISHER_TOKEN` (export từ `NotificationsModule`):

```ts
publish({ eventType, recipientId, payload?, dedupeKey? }): Promise<{ outcome, notificationId? }>
```

- `outcome`: `CREATED` | `DUPLICATE` (trùng `dedupeKey`) | `RECIPIENT_NOT_FOUND`.
- Thông báo được **lưu trước**, email gửi sau. Lỗi email không làm `publish` thất bại và không làm mất thông báo.
- `dedupeKey` nên ổn định theo nghiệp vụ, ví dụ `JOB_APPROVED:<jobId>:<decisionId>`.
- Payload chỉ chứa dữ liệu tối thiểu, không đưa dữ liệu nhạy cảm.

## 2. Sự kiện (draft)

| eventType | Người nhận | Email | Payload dùng |
|---|---|---|---|
| JOB_SUBMITTED_FOR_REVIEW | Moderator | Không | jobTitle, companyName |
| JOB_APPROVED | Employer | Có | jobTitle |
| JOB_REJECTED | Employer | Có | jobTitle, reason |
| JOB_HIDDEN | Employer | Có | jobTitle, reason |
| COMPANY_VERIFICATION_RESULT | Employer | Có | companyName, result, reason |
| APPLICATION_SUBMITTED | Employer | Không | jobTitle, studentName |
| APPLICATION_STATUS_CHANGED | Student | Có | jobTitle, status |
| INTERVIEW_INVITED | Student | Có | jobTitle, companyName, scheduledAt |
| INTERVIEW_CONFIRMED | Employer | Không | jobTitle |
| INTERVIEW_RESCHEDULE_REQUESTED | Employer | Có | jobTitle, reason |
| INTERVIEW_RESCHEDULE_RESOLVED | Student | Có | jobTitle, result |
| REPORT_RECEIVED | Người báo cáo | Không | — |
| REPORT_RESOLVED | Người báo cáo | Có | reason |
| SANCTION_APPLIED | Người bị chế tài | Có | sanctionType, reason |

## 3. REST API (prefix `/api/v1`, yêu cầu đăng nhập)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/notifications?page&limit&unreadOnly` | UC62 — danh sách của chính mình, mới nhất trước (limit tối đa 50) |
| GET | `/notifications/unread-count` | Số chưa đọc |
| GET | `/notifications/preferences` | S6-M05-03 — Danh sách tùy chọn nhận email thông báo của chính mình |
| PATCH | `/notifications/preferences` | S6-M05-03 — Cập nhật tùy chọn email theo loại thông báo (`{ eventType, emailEnabled }`) |
| PATCH | `/notifications/read-all` | UC63 — đọc tất cả |
| PATCH | `/notifications/:id/read` | UC63 — đọc một thông báo (idempotent). Không thuộc về mình → 404 `NOTIFICATION_NOT_FOUND` |

## 4. Tùy chọn nhận email (S6-M05-03)

- Bảng dữ liệu: `NotificationEmailPreference` (id, userId, eventType, emailEnabled, createdAt, updatedAt) với unique `(userId, eventType)`.
- Giá trị mặc định khi chưa cấu hình: `true` (cho tất cả 11 loại sự kiện có hỗ trợ gửi email).
- Khi người dùng tắt email (`emailEnabled = false`):
  - Thông báo trong ứng dụng vẫn được lưu và tăng số chưa đọc (`unreadCount`).
  - Trạng thái email được đặt là `NOT_REQUIRED`.
  - Không gửi email đến hộp thư người dùng.
- Kiểm tra kép (dual-check): kiểm tra lúc `publish` để bỏ qua dispatch; và kiểm tra lúc `dispatch` (hàng đợi/retry) để hủy gửi nếu người dùng vừa tắt tùy chọn.
- Phân quyền & sở hữu: API luôn lấy `userId` từ `AuthContext` (JWT token đã xác thực), không nhận `userId` từ client parameter để chống sửa chéo dữ liệu.

## 4. Trạng thái email

`NOT_REQUIRED` | `PENDING` → `SENT` | `FAILED`

- Gửi thất bại → `FAILED`, lịch thử lại 1 → 5 → 15 → 60 phút, tối đa 5 lần (kể cả lần đầu). Hết lượt thì `emailNextRetryAt = null`.
- Chống gửi trùng bằng lease (`emailNextRetryAt` được đẩy 5 phút khi đang gửi).
- `RetryPendingNotificationEmailsUseCase` xử lý hàng đợi; **chưa gắn scheduler** vì chưa chốt ai sở hữu UC61/UC68.

## 5. Câu hỏi mở

1. Danh sách eventType và payload có đủ cho M03/M04 chưa?
2. C-20 có thay thế C-10/C-11 trong bảng Contract của M05 không?
3. Ai sở hữu job retry email (UC61/UC68)?
4. Gửi thông báo cho cả nhóm Moderator (JOB_SUBMITTED_FOR_REVIEW) cần danh sách người nhận theo role từ M01.
