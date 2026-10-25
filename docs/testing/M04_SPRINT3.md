# 1. S3-M04-01 — Ma trận nghiệm thu ứng tuyển và phỏng vấn

Ngày đối chiếu: 23/10/2026. Repository: bản 23-10-26, nhánh main tại thời điểm khảo sát. Workbook: bản “Nhóm 11 (2).xlsx”, sheet “Module 4 - Gia Khang”, hàng 30–31. File này mô tả trạng thái thực tế, không thay đổi trạng thái trong Excel.

## 1.1. Yêu cầu, nguồn và độ sẵn sàng

| Yêu cầu | Nguồn | Hiện thực trong checkout | Dependency/việc cần làm | Kế hoạch test |
|---|---|---|---|---|
| CV bất biến sau nộp | C-03, UC37/UC38; CV_APPLICATION_INTEGRATION_CONTRACT.md | Có Cv, GetCvSnapshotUseCase, CvSnapshotSourceAdapter; tài liệu C-03 APPROVED / READY | Cần kiểm tra mapping userId ↔ StudentProfile.id trước binding M04 | API nộp → sửa CV qua M02 → đọc lại application |
| Tin còn nhận hồ sơ, HR sở hữu tin | C-07, workbook M03 hàng 34 | Có Company/Branch schema; chưa có Job model, Job API hoặc JobAccessSource thật | M03 cung cấp eligibility/ownership API đúng C-07; không đọc DB M03 từ M04 | Test tin mở/đóng/hết hạn và HR khác doanh nghiệp |
| Quy trình ứng tuyển/phỏng vấn | M04 hàng 25–30; m04-workflow.ts | Có controller/workflow/Prisma repository nhưng AppModule chưa import M04 | Bind adapter CV và Job thật, kiểm chứng JWT/role/identity | HTTP → workflow → PostgreSQL, không override workflow/guard |
| Notification đúng người, chống trùng | C-10/C-15; NOTIFICATION_API_CONTRACT.md | Có NotificationsModule; contract C-20 DRAFT, mapping C-10/C-15 chưa rõ | Owner M04/M05 chốt payload, recipient, event ID, duplicate/retry | Thao tác thật → đọc notification của các recipient; replay theo contract |
| State rule | CR-07 trong workbook; ROLES_AND_STATES.md; domain hiện có | Mã đang dùng SUBMITTED/REVIEWING/INTERVIEW_SCHEDULED/ACCEPTED/REJECTED/WITHDRAWN; workbook P2_07 CR-07 dùng bộ tên khác | Owner/PM xác nhận ma trận/mapping trước nghiệm thu; không đổi enum đơn phương | Regression theo rule đang chạy; chưa coi là bằng chứng tuân thủ rule mới |
| Persistence và giao dịch M04 | TEST_PLAN.md §2.2; PrismaM04Repository | Repository và migration đã có; database test đã migrate | campusjob_m04_test local riêng, PostgreSQL healthy | DB01–DB10 đã đạt 10/10; xem M04_SPRINT3_RESULTS.md |

**S3-M04-01 chưa thể nghiệm thu full integration.** Test fixture HTTP cũ ở m04-contract.e2e-spec.ts dùng mock workflow/guard; không đủ thay thế full E2E. Suite PostgreSQL mới chỉ chứng minh persistence M04, không chứng minh CV ownership, Job eligibility, JWT, UI hoặc notification.

## 1.2. Ma trận full E2E

Mỗi case tạo dữ liệu qua API/module thật sau khi dependency Ready; sử dụng hai sinh viên S1/S2, hai employer E1/E2 thuộc doanh nghiệp khác nhau và tin J1 thuộc E1. Các path dưới đây đã tồn tại trong M04Controller nhưng hiện chưa được gắn vào AppModule. Prefix /api/v1.

| ID | UC / contract | Tiền điều kiện | Bước/request | Kết quả mong đợi và kiểm chứng | Kết quả thực tế | Trạng thái / blocker |
|---|---|---|---|---|---|---|
| E01 | UC38 / C-03,C-07 | S1 có CV; J1 đang mở | S1 POST /jobs/:jobId/apply | Một application SUBMITTED, đúng người/tin/CV, history khởi tạo | Chưa chạy | BLOCKED: Job adapter + binding M04 |
| E02 | UC37/38 / C-03 | E01 thành công | Đọc Application.cvSnapshot và CV nguồn | Snapshot đúng dữ liệu lúc nộp, đúng studentId/cvId; cần xác nhận namespace ID | Chưa chạy | BLOCKED: E01; mapping identity |
| E03 | UC36/37 / C-01 | S1/S2 có application riêng | GET /applications/me và /applications/me/:id | S1 chỉ nhận hồ sơ S1; truy cập ID S2 không lộ dữ liệu | Chưa chạy | BLOCKED: real route binding |
| E04 | UC36/37 / C-07 | E1 quản lý J1 | E1 GET /employer/jobs/:jobId/applications | Chỉ application của J1; thứ tự theo rule hiện hành | Chưa chạy | BLOCKED: Job ownership API |
| E05 | UC37/39 / C-01,C-07 | E2 không quản lý J1 | E2 GET/PATCH /employer/applications/:id[/viewed] | Bị từ chối; DB/history không thay đổi, không lộ CV | Chưa chạy | BLOCKED: Job ownership API |
| E06 | UC39 / state rule | Application SUBMITTED | E1 PATCH .../:id/viewed, sau đó thao tác hợp lệ tiếp theo | Đúng transition/actor/history; state vocabulary cần Owner chốt | Chưa chạy | BLOCKED: binding + state reconciliation |
| E07 | UC41 / C-14 | Application đủ điều kiện | POST /employer/applications/:id/interviews | Lịch tương lai, đúng application, transition và history đồng bộ | Chưa chạy | BLOCKED: binding; C-14 chưa có registry riêng |
| E08 | UC40/42 / C-14 | Có lịch của S1 | S1 GET /interviews/me; POST /interviews/:id/confirm; S2 truy cập thử | Chỉ S1 xem/xác nhận được; xác nhận lặp không tạo phản hồi mới | Chưa chạy | BLOCKED: binding |
| E09 | UC43 / C-14 | Lịch chưa xảy ra | S1 POST /interviews/:id/change-request hai lần | Theo rule hiện tại: tối đa một request; DB không trùng | Chưa chạy | BLOCKED: binding; Owner xác nhận rule |
| E10 | UC44 / C-14 | Request PENDING | E1 PATCH /employer/interviews/:id/change-request; gửi lại quyết định | Một quyết định hiệu lực; approve đổi lịch, reject giữ lịch; không trùng | Chưa chạy | BLOCKED: binding |
| E11 | UC39 + nhóm phỏng vấn / C-14 | Cuộc phỏng vấn đã xảy ra | E1 PATCH /employer/interviews/:id/result | Interview.result, application.status, history nhất quán; không chốt hai lần | Chưa chạy | BLOCKED: binding + state rule |
| E12 | UC34/37/38 / C-03 | E01 thành công | S1 sửa CV qua API M02, đọc lại application | Snapshot cũ không đổi; tuyệt đối không thay bằng đọc lại CV mới | Chưa chạy | BLOCKED: E01 |
| E13 | C-10/C-15; UC62/63 nếu thông báo | Contract M05 được duyệt | Chạy E01/E06/E07/E08/E10/E11; đọc notification từng người; retry event theo contract | Đúng event/payload/recipient, không lộ dữ liệu và không trùng; chưa đặt payload khi chưa duyệt | Chưa chạy | BLOCKED: C-20 DRAFT, chưa có M04 publisher binding |
| E14 | UC39 / state rule | Application đã rút hoặc có kết quả cuối | Lặp cập nhật/invite/result | Từ chối theo state rule; không tạo history/lịch/notification mới | Chưa chạy | BLOCKED: binding + reconciliation |
| E15 | UC38/39/41 / C-03,C-07,C-14 | Job đóng/hết hạn; CV người khác; application trùng | Nộp sai CV, nộp trùng/đồng thời, transition sai, lịch quá khứ | Trả lỗi theo contract; không ghi nửa giao dịch, không trùng | Chưa chạy | BLOCKED: Job adapter/binding |

Đối với result, không gán mã PV legacy thành một UC mới hoặc ánh xạ PV01–PV07 1:1 với UC40–UC44. C-14/C-15 có ở task sheet nhưng chưa tìm thấy định nghĩa contract có trạng thái duyệt riêng trong repository.

## 1.3. Regression PostgreSQL đã bổ sung

File: apps/api/test/m04-persistence.integration-spec.ts. Không nằm trong discovery E2E mặc định để tránh chạy nhầm database dev hoặc bị hiểu là full E2E.

| ID | Kiểm chứng | Giới hạn |
|---|---|---|
| DB01 | Snapshot đã lưu không thay theo object đầu vào; history ban đầu | Không phải kiểm thử sửa CV thật M02 (E12) |
| DB02 | Hai submission đồng thời chỉ có một application/history | Unique constraint ở repository; không kiểm tra Job/CV eligibility |
| DB03 | Stale status update rollback, không thêm history | Không thay thế state-machine/role test |
| DB04 | Hai lời mời đồng thời chỉ tạo một lịch/transition | Atomicity persistence |
| DB05 | Xác nhận đồng thời chỉ một response | Atomicity persistence |
| DB06 | Đề nghị đổi lịch đồng thời không trùng | Unique constraint |
| DB07 | Approve đổi lịch một lần; quyết định lặp không ghi đè | Transaction và history liên quan |
| DB08 | Reject giữ lịch; không thể approve lại | Transaction |
| DB09 | Kết quả trước thời điểm lịch bị từ chối | Không đổi application/history |
| DB10 | Hai kết quả cạnh tranh chỉ một kết quả nhất quán | Result/application/history cùng transaction |

## 1.4. Chạy lại

1. Cài dependency theo README: pnpm install --frozen-lockfile; pnpm db:generate.
2. Chuẩn bị **database mới, riêng** tên campusjob_m04_test trên PostgreSQL local. Không reset database campusjob hoặc xóa volume.
3. Gán M04_TEST_DATABASE_URL trỏ đến database test đó (schema public). Guard từ chối URL thiếu, database khác, host ngoài local hoặc schema khác.
4. Áp migration sẵn có chỉ vào database test:

```powershell
$env:M04_TEST_DATABASE_URL = 'postgresql://<user>:<password>@localhost:5435/campusjob_m04_test?schema=public'
$env:DATABASE_URL = $env:M04_TEST_DATABASE_URL
pnpm --filter @campusjob/api exec prisma migrate deploy
pnpm test:m04:postgres
```

Chạy trong terminal riêng; khi xong bỏ hai biến môi trường tạm hoặc đóng terminal. Suite chỉ xóa Application do từng case tạo; FK cascade dọn child rows. Không reset/truncate, không override M02/M03/M05.

Các kiểm tra chung: pnpm typecheck; pnpm lint; pnpm test; pnpm build. Chỉ chạy pnpm test:e2e trên database cô lập đã migrate (kiểm tra scripts/test cũ vì chúng có cleanup riêng).

Kết quả thực thi và blocker được ghi trong M04_SPRINT3_RESULTS.md. Không đánh dấu E01–E15 pass từ kết quả DB01–DB10.
