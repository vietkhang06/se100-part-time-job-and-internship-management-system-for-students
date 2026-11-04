# Báo cáo triển khai và kiểm tra nhanh M04 — 2026-11-02

## Phạm vi và nguồn yêu cầu

- Excel `[SE100.R14 - Phương pháp phát triển phần mềm hướng đối tượng] Nhóm 11 (3).xlsx`, sheet `Module 4 - Gia Khang`, các dòng task 32–38.
- `docs/api/M04_APPLICATION_INTERVIEW_CONTRACT.md`, `docs/api/CV_APPLICATION_INTEGRATION_CONTRACT.md`.
- `docs/ROLES_AND_STATES.md`, `docs/decisions/DECISION_LOG.md`, README, Prisma schema/migrations và contract dùng chung.
- Ảnh task được đối chiếu bằng đúng ID S3-M04-03 đến S5-M04-04; ảnh chỉ dùng để định vị, Excel/tài liệu là nguồn chi tiết.

## Truy vết task

| Task | Yêu cầu/AC đã xử lý | Code chính | Trạng thái triển khai | Xác minh nhanh |
|---|---|---|---|---|
| S3-M04-03 | Quota 5 hồ sơ active; active gồm `SUBMITTED`, `REVIEWING`, `INTERVIEW_SCHEDULED`; terminal không tính; cấm re-apply cùng student/job; chống race và rollback sạch | submission policy, `PrismaM04Repository`, unique index hiện có | Đầy đủ theo yêu cầu đã xác định | PASS — unit, PostgreSQL concurrent boundary, API thật |
| S3-M04-04 | Sáu trạng thái chuẩn; actor/from/to; lý do từ chối; lịch sử; chặn 403/409; không thêm state | state machine, workflow, repository, controller/filter | Đầy đủ theo yêu cầu đã xác định | PASS — unit, contract API và API thật |
| S4-M04-01 | Lịch tương lai có timezone; mode/location/link/message; confirm; tối đa một change request; phê duyệt đổi đúng lịch hiện tại; một interview active | DTO, interview rules, workflow, transaction/constraints | Đầy đủ theo yêu cầu đã xác định | PASS — unit, PostgreSQL và API thật |
| S5-M04-01 | `M04Module.register()` production; AppModule; adapter M02/M03 thật; sửa mapping User.id → StudentProfile; startup | AppModule, M04Module, M02 snapshot use case, M03 adapter | Đầy đủ theo yêu cầu đã xác định | PASS — wiring test, build, startup thật |
| S5-M04-02 | List/detail theo job thuộc company; role quản lý hợp lệ; sort ổn định; pagination; mark viewed; snapshot CV bất biến; score không bịa | workflow/controller/DTO, M03 ownership adapter | Đầy đủ theo yêu cầu đã xác định | PASS — unit, contract API và API thật |
| S5-M04-03 | ACCEPTED/REJECTED qua state machine; lịch sử/lý do; đếm accepted trong transaction; chỉ phát đề xuất đóng; idempotent mỗi job | workflow, outbox, M03 `JobCloseSuggestion` adapter | Đầy đủ theo yêu cầu đã xác định | PASS — PostgreSQL và API thật; Job vẫn `OPEN` |
| S5-M04-04 | Event submit/status/invite/confirm/reschedule/result; actor/recipient/entity/payload; transactional outbox; dedupe; retry; không dựng email/notification ngoài M05 | shared contract, workflow, repository, dispatcher, M05 template | Đầy đủ theo yêu cầu đã xác định | PASS — unit, PostgreSQL entity-ID test và API thật |

## Quyết định và invariant đã áp dụng

- Giữ unique `(studentId, jobId)`: re-apply bị cấm kể cả hồ sơ cũ đã terminal, đúng contract/GL-16; không thay constraint khi chưa có quyết định mới.
- Serialize thao tác submit theo student bằng PostgreSQL transaction advisory lock; kiểm tra quota, tạo application, history và outbox trong cùng transaction.
- Matching score trả trạng thái `UNAVAILABLE` (`SKILLS_MISSING` hoặc `FORMULA_UNAPPROVED`); không tự đặt công thức khi nguồn chưa phê duyệt.
- Quyền HR được kiểm tra bằng membership active và vai trò quản lý của đúng company sở hữu job, không chỉ dựa trên JWT role `EMPLOYER`.
- Event được ghi cùng transaction dữ liệu, có dedupe key, retry exponential backoff và worker quét 30 giây. M05 vẫn sở hữu việc tạo notification/email.
- Khi đủ số lượng, M04 chỉ gửi tín hiệu cho adapter M03 tạo `JobCloseSuggestion` duy nhất; không cập nhật `JobPosting.status`.

## Thành phần chính đã sửa

- `apps/api/src/modules/applications/`: hoàn thiện workflow, controller/DTO, production module wiring, Prisma repository và outbox dispatcher.
- `apps/api/src/modules/companies/infrastructure/adapters/job-access-source.adapter.ts`: adapter C-07 cho eligibility, ownership, job context và close suggestion.
- `apps/api/src/modules/students/application/use-cases/get-cv-snapshot.use-case.ts`: sửa identity boundary để nhận authenticated User.id và lấy đúng StudentProfile.
- `packages/contracts/src/index.ts`: bổ sung job-access contract và event kết quả tuyển dụng.
- `apps/api/prisma/schema.prisma` và migration `20261102090000_m04_production_events_and_close_suggestion`: transactional outbox và close suggestion idempotent.
- Các spec M04/M02/M03/M05, contract API và PostgreSQL integration được cập nhật/bổ sung để bảo vệ invariant cốt lõi.

## Lệnh và kết quả

| Kiểm tra | Kết quả |
|---|---|
| `pnpm typecheck` | PASS — contracts, API, web |
| `pnpm --filter @campusjob/api lint` | PASS |
| `pnpm --filter @campusjob/api build` | PASS |
| Unit mục tiêu M04 + M02 snapshot + M03 adapter + M05 template | PASS — 55/55 |
| `m04-contract.e2e-spec.ts` | PASS — 6/6 |
| contracts test | PASS — 2/2 |
| `pnpm test:m04:postgres` với `M04_TEST_DATABASE_URL` trỏ `campusjob_m04_test` | PASS — 12/12 |
| `git diff --check` | PASS |
| Prisma validate với local `DATABASE_URL` | PASS |
| `pnpm db:deploy` trên local `campusjob` | PASS — áp dụng migration JobPosting đang chờ và migration M04 mới |
| `pnpm --filter @campusjob/api start:dev` | PASS — ứng dụng khởi động, route M04 được map |

Lần gọi đầu của PostgreSQL suite không truyền `M04_TEST_DATABASE_URL` nên bị fail-closed đúng thiết kế; suite được chạy lại với database test tách biệt và đạt 12/12. Không reset database hoặc xóa volume.

### Smoke API thật

Smoke harness tạm thời dùng đăng ký/đăng nhập thật, JWT thật, production adapters và PostgreSQL local; dữ liệu có tag riêng và đã được dọn theo ID trong `finally`. Kết quả:

- Quota boundary: 4 hồ sơ sẵn có + 2 request đồng thời → đúng 1 request 201, 1 request 409 `QUOTA_EXCEEDED`, dữ liệu cuối là 5.
- Employer company khác bị 403 khi đọc/sửa; owner đúng xem list/detail, pagination và mark viewed thành công.
- Từ chối thiếu reason bị 400 và dữ liệu không đổi; reason hợp lệ được lưu vào application/history.
- Lịch quá khứ bị 409 và không tạo row; invite/confirm/change-request/approve thành công; request lần hai bị 409.
- Kết quả ACCEPTED sau thời điểm phỏng vấn tạo history/event; close suggestion đúng một bản ghi; JobPosting vẫn `OPEN`.
- Outbox khả dụng được giao hết cho M05; kiểm tra payload/recipient và không có event thành công cho thao tác thất bại.

## Khởi động và test nhanh

1. Dùng PostgreSQL/Mailpit local theo Compose của dự án; xác nhận không phải production.
2. Cấu hình `.env` local theo `.env.example`, sau đó chạy `pnpm db:deploy`.
3. Chạy API bằng `pnpm --filter @campusjob/api start:dev`.
4. Dùng tài khoản local có role STUDENT và EMPLOYER; EMPLOYER phải là member active có role quản lý của company chứa job OPEN. Không có tài khoản/mật khẩu test cố định được lưu trong báo cáo. Tài khoản smoke tạm đã bị xóa.
5. Chạy unit/contract bằng các lệnh trên; PostgreSQL suite chỉ chạy khi `M04_TEST_DATABASE_URL` trỏ đúng database `campusjob_m04_test`.

## Phần chưa xác định và giới hạn xác minh

- Công thức matching score chưa có quyết định nghiệp vụ được phê duyệt; implementation chủ động trả `FORMULA_UNAPPROVED` thay vì bịa điểm.
- Đã kiểm tra nhanh đường chính và rủi ro cốt lõi; chưa tuyên bố bao phủ toàn bộ ma trận tổ hợp, tải lớn, process crash ở mọi điểm hoặc outage dài hạn của M05/M03.
- Candidate pagination hiện thực hiện sau khi repository lấy danh sách theo job. Kết quả đúng contract, nhưng cần chuyển pagination xuống query DB nếu đo tải thực cho thấy job có lượng hồ sơ lớn.
- Không có blocker ngăn đường chạy hiện tại. Không commit, push, merge hoặc triển khai production.

## Kiểm thử chuyên sâu đề xuất cho lượt sau (theo rủi ro)

1. Stress đồng thời nhiều API instance tại quota 4/5 và duplicate cùng job; kiểm tra advisory-lock contention/timeout.
2. Fault injection tại từng điểm business transaction/outbox publish/process crash; xác minh replay/dedupe và backlog recovery.
3. Ma trận đầy đủ mọi actor × source state × target action, kể cả token hết hạn và membership đổi trạng thái giữa request.
4. Timezone/DST/offset biên, lịch đúng bằng `now`, approve change request sát giờ và nhiều request cạnh tranh.
5. Tải lớn cho candidate list; chuyển pagination/sort xuống Prisma query và đo index plan nếu cần.
6. Contract test liên module M02/M03/M05 trong CI dùng service thật, bao gồm job bị đóng/hết hạn và CV ownership thay đổi.
7. Theo dõi outbox backlog, retry exhaustion/alerting và chính sách lưu trữ event/close suggestion.
