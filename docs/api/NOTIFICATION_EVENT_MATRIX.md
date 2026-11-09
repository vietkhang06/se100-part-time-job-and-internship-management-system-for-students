# S3-M05-05 — Ma trận Notification Event / Recipient (C-20) cho M01–M04

> Task: S3-M05-05. Contract: C-11, C-20. Reviewer (cột K sheet): Gia Khang.
> Fixture + test: `apps/api/src/modules/notifications/domain/templates/notification-event.fixtures.ts` và `notification-event-matrix.spec.ts` (kiểm tra ma trận này khớp enum và template trong code).
> Nguyên tắc của task: event/payload **chưa chốt thì không được implement bằng suy luận**. Ma trận ghi theo **code thật trên `main`** (sau PR #48 của M04); chỗ nào chưa có producer thì ghi DRAFT.

## 1. Quy tắc chung (áp dụng mọi event)
1. Mỗi event có **actor** (ai gây ra), **entity** (đối tượng nghiệp vụ), **recipient** (rule chọn người nhận) rõ ràng; không gửi cho user không liên quan.
2. Người nhận luôn là **một userId cụ thể**. Event cho nhóm (Moderator, các quản lý của tin) là **fan-out**: producer lặp từng người và `dedupeKey` **phải có `:<recipientId>`**, vì `dedupeKey` là UNIQUE toàn bảng `Notification`. M04 đã làm đúng: mọi event M04 đều có `recipientId` trong khóa.
3. Thông báo trong ứng dụng **luôn được lưu trước**; email gửi sau, lỗi email không làm `publish` lỗi và không xóa thông báo (test TM-E1).
4. `dedupeKey` ổn định theo nghiệp vụ, bắt đầu bằng `<EVENT_TYPE>:`; gọi lại cùng khóa trả `DUPLICATE`, không tạo thông báo hay email thứ hai.
   - Event của M04 dùng khóa `<EVENT>:<entityId>:<recipientId>:<occurrence>` với `occurrence` = `status` ?? `result` ?? `proposedAt` ?? `scheduledAt` ?? `once`.
5. Payload chỉ chứa id + dữ liệu hiển thị tối thiểu; **không** có email, số điện thoại, token, link CV, `storageKey`. Payload M04 còn được gắn thêm id thực thể (`applicationId`, `interviewId`, `changeRequestId`), `actorId` và `recipientId`.
6. Retry email (đã cài): lần 1 lỗi → thử lại sau 1, 5, 15, 60 phút; tối đa 5 lần kể cả lần đầu; hết lượt thì `emailNextRetryAt = null`, trạng thái `FAILED`. Lease 5 phút chống gửi trùng. M04 có thêm outbox riêng với retry backoff trước khi gọi `publish`.
7. **Email preference:** việc gửi email do template quyết định theo từng loại (cột "Email"). Tùy chọn bật/tắt theo người dùng là việc của S6-M05-03 (PR riêng); sau khi PR đó merge, người dùng tắt loại nào thì loại đó không gửi email nhưng thông báo trong ứng dụng vẫn lưu.

## 2. Ma trận (15 event trong `NotificationEventType`)

| # | eventType | Trạng thái | Producer | Actor | Entity | Người nhận | Email | Payload bắt buộc |
|---|---|---|---|---|---|---|---|---|
| 1 | `JOB_SUBMITTED_FOR_REVIEW` | DRAFT | M03 | Employer | Job + ModerationItem | Mọi Moderator (fan-out) | Không | jobId, jobTitle, companyName, moderationItemId |
| 2 | `JOB_APPROVED` | **Đã có** | M05 | Moderator | Job + Decision | Người gửi tin (`submitterId`) | Có | jobId, moderationItemId |
| 3 | `JOB_REJECTED` | **Đã có** | M05 | Moderator | Job + Decision | Người gửi tin | Có | + reason (bắt buộc) |
| 4 | `JOB_HIDDEN` | **Đã có** | M05 | Moderator | Job + Decision | Người gửi tin | Có | + reason (bắt buộc) |
| 5 | `COMPANY_VERIFICATION_RESULT` | DRAFT | M03 | Chưa chốt | Company | Chủ doanh nghiệp | Có | companyId, companyName, result |
| 6 | `APPLICATION_SUBMITTED` | **Đã có** | M04 | Student | Application | Các quản lý của tin (fan-out) | Không | jobId, jobTitle, companyId, companyName, studentName |
| 7 | `APPLICATION_STATUS_CHANGED` | **Đã có** | M04 | Employer; Student (rút hồ sơ) | Application | Student chủ hồ sơ; **các quản lý khi Student rút hồ sơ** | Có | jobId, jobTitle, fromStatus, status |
| 8 | `INTERVIEW_INVITED` | **Đã có** | M04 | Employer | Interview | Student chủ hồ sơ | Có | jobId, jobTitle, companyId, companyName, scheduledAt, mode, locationOrLink |
| 9 | `INTERVIEW_CONFIRMED` | **Đã có** | M04 | Student | Interview | Các quản lý của tin (fan-out) | Không | jobId, jobTitle, scheduledAt |
| 10 | `INTERVIEW_RESCHEDULE_REQUESTED` | **Đã có** | M04 | Student | Change request | Các quản lý của tin (fan-out) | Có | jobId, jobTitle, proposedAt |
| 11 | `INTERVIEW_RESCHEDULE_RESOLVED` | **Đã có** | M04 | Employer | Change request | Student chủ hồ sơ | Có | jobId, jobTitle, result (`APPROVED`\|`REJECTED`), proposedAt |
| 12 | `INTERVIEW_RESULT_RECORDED` | **Đã có** | M04 | Employer | Interview | Student chủ hồ sơ | Có | jobId, jobTitle, result (`ACCEPTED`\|`REJECTED`) |
| 13 | `REPORT_RECEIVED` | **Đã có** | M05 | Student/Employer | ViolationReport | Người báo cáo | Không | reportId |
| 14 | `REPORT_RESOLVED` | **Đã có** | M05 | Admin | ViolationReport | Người báo cáo | Có | reportId, outcome (`SANCTIONED`\|`CLOSED_WITHOUT_SANCTION`) |
| 15 | `SANCTION_APPLIED` | **Đã có** | M05 | Admin | Sanction | Đối tượng bị chế tài (**không** gửi người báo cáo) | Có | sanctionId, reportId, sanctionTypeCode, sanctionType |

Đã có producer thật: **13/15** (6 do M05, 7 do M04). **2/15 còn DRAFT** và đều của M03: #1 và #5. `JOB_CLOSE_SUGGESTED` là sự kiện nội bộ M04 → M03 (không phải thông báo), nằm ngoài ma trận này.

### 2.1 "Deadline reminder": đã có ở M03 nhưng **đi ngoài C-20**
M03 hiện có nhắc hạn đăng tin (`IJobExpiryNotifier`, bảng `JobExpiryReminderLog`) nhưng gửi **thẳng email qua `MailService`**: không tạo thông báo trong ứng dụng, không đi qua `INotificationPublisher`, không có `dedupeKey` của `Notification`, không theo retry/preference của M05. Không có eventType tương ứng trong enum, nên ma trận này **không thêm event**. Hạn phản hồi phỏng vấn và hủy lời mời vẫn không có quy tắc (hợp đồng M04), UC61/UC68 vẫn chưa có chủ. Cần Owner trả lời: có đưa nhắc hạn của M03 vào C-20 (thêm eventType, người nhận là chủ tin) hay giữ như hiện tại.

## 3. Việc từng module phải chốt (blocker)
| Module | Cần chốt | Event ảnh hưởng |
|---|---|---|
| M01 | API lấy danh sách Moderator theo role (fan-out) | #1 |
| M03 | Tin vào hàng đợi kiểm duyệt (`ModerationQueueAdapter`) nhưng **chưa gọi `publish`** cho Moderator | #1 |
| M03 | `VerifyCompanyUseCase` đã có nhưng **chưa gọi `publish`**; chốt giá trị `result` (đề xuất `APPROVED` \| `REJECTED`; `reason` bắt buộc khi REJECTED) | #5 |
| M03/M05 | M05 cần biết user chủ doanh nghiệp để gửi `SANCTION_APPLIED` khi đối tượng là doanh nghiệp | #15 |
| M04 | Khi Student rút hồ sơ, `APPLICATION_STATUS_CHANGED` đi tới các quản lý (không phải Student): xác nhận đây là ý định | #7 |
| M04 | Payload `INTERVIEW_INVITED` chứa `locationOrLink` (địa điểm hoặc đường dẫn họp) và được lưu trong thông báo/gửi email: xác nhận được phép | #8 |
| M04 | Ghi kết quả phỏng vấn phát **hai** thông báo cho Student (`INTERVIEW_RESULT_RECORDED` và `APPLICATION_STATUS_CHANGED`), cả hai có email: xác nhận có chủ ý hay gộp một | #7, #12 |
| M04 | Thông báo "hồ sơ mới" và "xác nhận lịch" không có email: xác nhận | #6, #9 |

## 4. Tiêu chí nghiệm thu ↔ bằng chứng
| Tiêu chí | Bằng chứng |
|---|---|
| Mỗi event có actor/entity/recipient rõ | Bảng mục 2 + trường `actor`/`entity`/`recipient` của fixture (spec kiểm đủ 1 fixture/enum) |
| Không gửi cho user không liên quan | Rule mục 1.2, test thật TM-A11, TM-C2, TM-G1, TM-H1 |
| Email lỗi không xóa thông báo in-app | Mục 1.3, test thật TM-E1 |
| Event/payload chưa chốt không implement bằng suy luận | Cột Trạng thái = DRAFT; mục 2.1; spec chỉ cho IMPLEMENTED khi producer là M04/M05 |
| Fixtures | `notification-event.fixtures.ts` (15 fixture, payload và khóa lấy từ producer thật) |

## 5. Câu hỏi mở (cho Lead)
1. C-20 có thay C-10/C-11 trong bảng Contract của M05 không?
2. Có cần event thông báo cho **gỡ chế tài** / **chế tài hết hạn** không? UC59/UC60 không yêu cầu; hiện không có. Chỉ thêm nếu Owner duyệt.
3. Nhắc hạn đăng tin của M03 (mục 2.1): đưa vào C-20 hay giữ gửi thẳng email?
4. Các điểm M04 cần xác nhận ở mục 3 (rút hồ sơ, `locationOrLink`, hai thông báo cho một kết quả).
