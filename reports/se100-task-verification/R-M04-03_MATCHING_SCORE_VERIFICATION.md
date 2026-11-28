# R-M04-03 — verification, 28/11/2026

HEAD trước thay đổi: `aefe579e50ef297435124bc9f16d17f11fa43dbf`, branch `main`. Gia Khang đã duyệt triển khai phương án M04 trong chat. Ngày 28/11/2026, người dùng xác nhận **chưa có danh sách alias đã thống nhất; dùng exact canonical ID trước**. Vì vậy synonym mapping vẫn là gap nghiệm thu, không tự thêm alias minh họa. Chưa có bằng chứng Owner/PM, M02, M03 ký duyệt alias catalog và các contract đầu vào. Prompt tái chạy: `docs/testing/R-M04-03_VERIFICATION_PROMPT.md`; prompt triển khai chi tiết: `docs/testing/R-M04-03_IMPLEMENTATION_AND_ACCEPTANCE_PROMPT.md`.

## Đã thực hiện

- Thêm pure scorer 80/20 version 1.0.0 và unit tests. Scorer nhận canonical IDs đã xác thực, phân biệt missing với CV rỗng được xác nhận, dedup và làm tròn half-up. Scorer chưa được nối production vì dữ liệu hiện tại chỉ là tên kỹ năng dạng chuỗi, không có preferred skills hoặc job revision.
- Khắc phục lỗi typecheck: import sanctions token/interface và đăng ký SanctionsModule trong M04; import EmailRetrySchedulerService trong NotificationsModule.

## Lệnh và kết quả

| Lệnh | Kết quả |
|---|---|
| `pnpm.cmd --filter @campusjob/contracts build` | PASS |
| `pnpm.cmd --filter @campusjob/api exec prisma generate --schema prisma/schema.prisma` | PASS |
| `pnpm.cmd --filter @campusjob/api exec jest --runInBand src/modules/applications/domain/approved-matching-score.spec.ts` | PASS 10/10 sau bổ sung explanation ổn định |
| `pnpm.cmd --filter @campusjob/api exec jest --runInBand src/modules/applications/domain/approved-matching-score.spec.ts src/modules/applications/domain/matching-score.spec.ts src/modules/applications/application/m04-workflow.spec.ts` | PASS 21/21, trước bổ sung nhánh missing/empty; test scorer 9/9 đã chạy lại sau sửa |
| `pnpm.cmd --filter @campusjob/api typecheck` | PASS sau khi sửa imports/module wiring |
| `pnpm.cmd --filter @campusjob/api lint` | PASS, 0 errors, 104 warnings |
| `git diff --check` | PASS |

## Ma trận nghiệm thu

`U` = unit scorer đã chạy PASS trong `approved-matching-score.spec.ts`; `B` = BLOCKED do contract/dữ liệu đầu vào; `N` = NOT RUN. Unit test dùng command Jest ở trên. Các dòng B/N chưa có expected/actual ở production nên không được tính PASS.

| ID | Expected | Actual / evidence | Status |
|---|---|---|---|
| MS-01 | 100 | 100 | U |
| MS-02 | 70 | 70 | U |
| MS-03 | 80 | 80 | U |
| MS-04 | 20 | 20 | U |
| MS-05 | 0 hợp lệ | 0 | U |
| MS-06 | Missing → unavailable | Null/absent → SKILLS_MISSING | U |
| MS-07 | CV rỗng xác nhận → 0 | 0 với `cvEmptyConfirmed` | U |
| MS-08 | Required rỗng | NO_REQUIRED_SKILLS | U |
| MS-09 | Preferred rỗng, 2/3 | 66.7 | U |
| MS-10 | Duplicate không tăng điểm | Dedup test PASS | U |
| MS-11 | Overlap thuộc required | Test PASS | U |
| MS-12 | Alias chính thức | Chưa có catalog versioned | B |
| MS-13 | Java khác JavaScript | ID khác không match; chưa có integration catalog | B |
| MS-14 | Invalid/ambiguous | Empty ID invalid; ambiguous alias chưa có catalog | B |
| MS-15 | Chưa duyệt → unavailable | Legacy scorer vẫn FORMULA_UNAPPROVED | U |
| MS-16 | Sửa CV không đổi score | Chưa lưu score/snapshot requirements | B |
| MS-17 | Sửa job không đổi score | Chưa có job revision snapshot | B |
| MS-18 | Thiếu job snapshot lịch sử | Chưa có persistence contract | B |
| MS-19 | Đảo thứ tự, cùng kết quả | Score/count/explanation canonical giống nhau trong unit test | U |
| MS-20 | Tie-break bằng điểm | Score sort chưa có | B |
| MS-21 | Asc/desc, unavailable cuối | Score sort chưa có | B |
| MS-22 | Sort toàn tập rồi paginate | Chưa có score sort | B |
| MS-23 | HR khác doanh nghiệp bị chặn | Workflow gọi `assertManagedBy`; E2E chưa chạy lần này | N |
| MS-24 | Score không đổi status | Scorer pure; production score chưa nối | B |
| MS-25 | UI reload khớp persisted score | Chưa lưu score | B |
| MS-26 | Industry không đổi điểm | Pure scorer không nhận industry; integration chưa có | B |
| MS-27 | Retry idempotent | Chưa lưu score | B |
| MS-28 | Không trộn version | Chưa có persisted version/cohort policy | B |
| MS-29 | Preferred absent khác empty | Unit test PASS | U |
| MS-30 | Half-up | 1/16 → 6.3 PASS | U |
| MS-31 | Scoring unavailable không chặn đơn | Chưa nối production; E2E chưa chạy | B |
| MS-32 | Gate quyền/sanction không bypass | SanctionsModule wiring được sửa; E2E chưa chạy | N |

## Vấn đề còn lại và thứ tự xử lý

1. M02/M03 cần xuất canonical skill IDs và alias catalog/version thật, cùng provenance của danh sách rỗng. Hiện `CvSnapshotDto.skills` và `ApplicationJobContextDto.requiredSkills` là `string[]` tên hiển thị.
2. M03 cần preferred skills và job requirements revision; M04 cần snapshot đầu vào bất biến, score/status/reason/version trong application, migration và test database độc lập.
3. Sau đó mới nối scorer vào submit/list/detail, thêm score sort API/UI, test authorization, pagination và human decision trên HTTP/browser.
4. Cần xác nhận phạm vi phê duyệt Owner/PM và đại diện M02/M03 theo decision record trước khi tuyên bố nghiệm thu chung.

**Verdict: PARTIAL / BLOCKED for full acceptance.** Production vẫn dùng scorer cũ và trả `UNAVAILABLE`; không có điểm giả. Không chạy database migration hay production E2E trên dữ liệu người dùng.
