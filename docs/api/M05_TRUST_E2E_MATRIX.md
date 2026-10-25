# S3-M05-01 — Trust Integration E2E Matrix + Regression Suite

> Task: S3-M05-01 (carry-over từ S2-M05-06, cùng một sản phẩm bàn giao — chỉ theo dõi **một** task đang hoạt động).
> Contract: C-16 (kiểm duyệt), C-17 (báo cáo), C-18 (đánh giá), C-19 (chế tài), C-20 (thông báo), C-02 (phân quyền).
> File test: `apps/api/test/m05-trust-integration.e2e-spec.ts`. Mã `TM-xx` trong bảng khớp tiền tố tên test.

## 1. Tiêu chí nghiệm thu ↔ test
| Tiêu chí (sheet) | Test chứng minh |
|---|---|
| Quyết định/chế tài/thông báo liên kết đúng đối tượng | TM-A1, TM-A7, TM-A10, TM-A11, TM-C2, TM-G1, TM-F4, TM-F5 |
| Đúng người nhận | TM-A11, TM-C2, TM-G1, TM-H1 |
| Chống xử lý trùng (quyết định, chế tài, thông báo, email) | TM-A2, TM-A7, TM-A12, TM-B1, TM-B2, TM-B3, TM-C2, TM-G1 |
| Không áp chế tài nếu thiếu căn cứ | TM-A6, TM-C1 |
| Chạy xuyên module báo cáo → kiểm duyệt → chế tài → thông báo | TM-A1 … TM-A16 |
| Dùng DB/test setup thật theo hạ tầng dự án | Toàn bộ: `AppModule` + PostgreSQL thật + người dùng thật qua JWT (cùng cách khởi tạo với `rbac.e2e-spec.ts`) |

"Liên kết đúng đối tượng" nghĩa là: dòng quyết định ghi đúng mục kiểm duyệt và người ra quyết định; dòng chế tài ghi đúng
`reportId`, đối tượng và Quản trị viên; mỗi thông báo mang `reportId`/`sanctionId`/`jobId`/`moderationItemId` đúng để giao diện điều hướng
(payload bổ sung ở task này: xem mục 4).

## 2. Ma trận kịch bản
| ID | Kịch bản | UC | Contract | Dữ liệu / ranh giới |
|---|---|---|---|---|
| TM-A1 | nhà tuyển dụng báo cáo sinh viên → 201, chờ thẩm tra, người báo cáo nhận đúng 1 thông báo REPORT_RECEIVED | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A2 | báo cáo trùng bị chặn: không tạo thêm báo cáo, mục kiểm duyệt hay thông báo | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A3 | báo cáo xuất hiện trong hàng đợi của Kiểm duyệt viên, sinh viên không xem được hàng đợi | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A4 | Kiểm duyệt viên xem được báo cáo kèm bằng chứng; người báo cáo không dùng được API thẩm tra | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A5 | chỉ người được giao mới xử lý mục kiểm duyệt | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A6 | chưa có kết luận "có căn cứ" thì Admin không thể áp chế tài hay đóng báo cáo | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A7 | kết luận sơ bộ chỉ được ghi một lần; báo cáo chuyển sang SUBSTANTIATED và vẫn chưa có chế tài | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A8 | chỉ Quản trị viên được áp chế tài (Moderator, nhà tuyển dụng, sinh viên đều bị 403) | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A9 | Admin thấy báo cáo đã có căn cứ trong danh sách chờ phán quyết | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A10 | Admin khóa quyền ứng tuyển: lưu chế tài kèm lịch sử, đóng báo cáo, ghi audit | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A11 | thông báo đến đúng người, đúng một lần (kể cả email); người không liên quan không nhận gì | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A12 | áp lại cho cùng báo cáo không đổi gì: không thêm chế tài, không thêm thông báo | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A13 | sinh viên thấy chế tài của mình; M04 đọc được trạng thái khóa qua cổng ISanctionQuery | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A14 | API thông báo chỉ trả thông báo của chính mình và đánh dấu đã đọc hoạt động đúng | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A15 | Admin gỡ chế tài: lịch sử được giữ, khóa ứng tuyển được nhả, gỡ lần hai bị từ chối | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-A16 | sau khi báo cáo cũ đã phán quyết, người báo cáo được gửi báo cáo mới về cùng đối tượng | UC48, UC49, UC50, UC52, UC57, UC59, UC60, UC62, UC63 | C-02, C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-B1 | hai Kiểm duyệt viên quyết định cùng lúc một mục: chỉ một quyết định được ghi | UC52, UC59, UC62 | C-16, C-19, C-20 | Postgres thật; email giả |
| TM-B2 | hai Admin áp chế tài cùng lúc cho một báo cáo: một chế tài, mỗi bên nhận đúng một thông báo | UC52, UC59, UC62 | C-16, C-19, C-20 | Postgres thật; email giả |
| TM-B3 | phát lại cùng một sự kiện (cùng dedupeKey) chỉ lưu và gửi email một lần | UC52, UC59, UC62 | C-16, C-19, C-20 | Postgres thật; email giả |
| TM-C1 | báo cáo bị bác bỏ thì không thể áp chế tài, người báo cáo có thể gửi lại | UC52, UC59, UC62 | C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-C2 | Admin đóng báo cáo không xử phạt: chỉ người báo cáo được thông báo, đối tượng không nhận gì | UC52, UC59, UC62 | C-16, C-17, C-19, C-20 | Postgres thật; email giả |
| TM-D1 | đủ ngưỡng cảnh cáo thì buộc khóa ứng tuyển; đang bị khóa thì không khóa chồng | UC59, UC60 | C-19 | Postgres thật |
| TM-D2 | thời hạn khóa ngoài khoảng cho phép bị từ chối và không ghi gì | UC59, UC60 | C-19 | Postgres thật |
| TM-E1 | chế tài vẫn được lưu và thông báo trong ứng dụng vẫn có; email gửi lại thành công sau đó | UC59, UC62 | C-19, C-20 | Postgres thật; SMTP giả (mô phỏng lỗi) |
| TM-F1 | chỉ hồ sơ đã có kết quả cuối mới được đánh giá, mỗi hồ sơ một đánh giá, và chỉ chủ hồ sơ mới đánh giá được | UC45, UC46, UC47, UC49, UC53 | C-16, C-17, C-18 | Postgres thật; adapter M03/M04 giả |
| TM-F2 | danh sách công khai ẩn danh người viết và có thống kê | UC45, UC46, UC47, UC49, UC53 | C-16, C-17, C-18 | Postgres thật; adapter M03/M04 giả |
| TM-F3 | doanh nghiệp phản hồi đúng một lần; nhà tuyển dụng khác không phản hồi được | UC45, UC46, UC47, UC49, UC53 | C-16, C-17, C-18 | Postgres thật; adapter M03/M04 giả |
| TM-F4 | báo cáo một đánh giá đưa cả mục báo cáo lẫn mục đánh giá vào hàng đợi kiểm duyệt | UC45, UC46, UC47, UC49, UC53 | C-16, C-17, C-18 | Postgres thật; adapter M03/M04 giả |
| TM-F5 | ẩn đánh giá: biến mất khỏi danh sách công khai và của nhà tuyển dụng, tác giả vẫn thấy trạng thái ẩn | UC45, UC46, UC47, UC49, UC53 | C-16, C-17, C-18 | Postgres thật; adapter M03/M04 giả |
| TM-F6 | duyệt lại: đưa vào hàng đợi lần nữa không tạo trùng, khôi phục thì hiển thị lại | UC45, UC46, UC47, UC49, UC53 | C-16, C-17, C-18 | Postgres thật; adapter M03/M04 giả |
| TM-G1 | đưa tin vào hàng đợi hai lần chỉ có một mục; duyệt tin → handler áp một lần, nhà tuyển dụng nhận đúng 1 thông báo | UC51, UC62 | C-16, C-20 | Postgres thật; handler tin tuyển dụng của M03 giả |
| TM-G2 | duyệt lại sau khi sửa tin: từ chối bắt buộc có lý do, và lý do được gửi tới nhà tuyển dụng | UC51, UC62 | C-16, C-20 | Postgres thật; handler tin tuyển dụng của M03 giả |
| TM-G3 | module đích lỗi: quyết định vẫn được lưu (chưa đồng bộ) và được áp lại khi module đích phục hồi | UC51, UC62 | C-16, C-20 | Postgres thật; handler tin tuyển dụng của M03 giả |
| TM-H1 | sinh viên báo cáo doanh nghiệp → kiểm duyệt → Admin đình chỉ: handler gọi đúng một lần, chủ doanh nghiệp được thông báo | UC49, UC56, UC57, UC59 | C-17, C-19, C-20 | Postgres thật; handler doanh nghiệp của M03 giả |
| TM-H2 | loại chế tài không phù hợp với đối tượng báo cáo bị từ chối | UC49, UC56, UC57, UC59 | C-17, C-19, C-20 | Postgres thật; handler doanh nghiệp của M03 giả |

## 3. Phần đang dùng đối tượng giả và việc cần làm khi nguồn thật sẵn sàng
Trạng thái theo sheet: M03 Company/Branch **xong**, M03 Job (S2-M03-03/04) **đang làm**, Job → Moderation (S2-M03-05) và Job → Application (S2-M03-06) **chưa làm**,
M04 (S2-M04-01…06) **đang làm**. Vì vậy các điểm sau chưa thể dùng dữ liệu thật:

| Đối tượng giả trong test | Cần thay bằng | Phụ thuộc | Test bị ảnh hưởng |
|---|---|---|---|
| `ICompanyDirectory`, `ICompanySanctionHandler`, resolver `COMPANY` | Adapter của M03 (Company) | M03 Company đã xong; chờ M03 đăng ký adapter | TM-F*, TM-H* |
| `IModerationTargetHandler` cho `JOB` | Handler của M03 | S2-M03-05 Job → Moderation (chưa làm) | TM-G* |
| `IApplicationReviewSource` | Adapter của M04 | S2-M04-02 Application Slice (đang làm) | TM-F* |
| Chưa có test | Nộp hồ sơ bị chặn khi sinh viên đang bị khóa (M04 gọi `ISanctionQuery.getApplicationLock`) | M04 | **TM-I1 (blocker)** |
| Chưa có test | Duyệt tin thật làm tin hiển thị/ẩn (M03) | S2-M03-05 | **TM-I2 (blocker)** |
| Chưa có test | Đình chỉ doanh nghiệp làm doanh nghiệp bị chặn đăng tin (M03) | M03 | **TM-I3 (blocker)** |

Quy tắc thay thế: giữ nguyên kịch bản và khẳng định, chỉ đổi phần khởi tạo (xóa đăng ký đối tượng giả, tạo dữ liệu bằng API/repository thật của module).

## 4. Thay đổi mã đi kèm (để thông báo liên kết đúng đối tượng)
Chỉ thêm trường vào `payload` của thông báo; không đổi tên sự kiện, người nhận hay quy tắc:
- `REPORT_RECEIVED`: `{ reportId }`
- `REPORT_RESOLVED`: `{ reportId, outcome: 'SANCTIONED' | 'CLOSED_WITHOUT_SANCTION', sanctionId?, reason? }`
- `SANCTION_APPLIED`: thêm `sanctionId`, `reportId`, `sanctionTypeCode`
- `JOB_APPROVED` / `JOB_REJECTED` / `JOB_HIDDEN`: thêm `moderationItemId` (đã có `jobId`)

## 5. Regression Suite
Chạy từ thư mục gốc repo (cần Postgres, không cần Mailpit):
```powershell
.\scripts\m05-regression.ps1
```
Gồm: toàn bộ unit test của 5 module M05, rồi `m05-trust-integration`. Bộ này phải xanh trước mỗi PR đụng tới `notifications`, `moderation`, `reports`, `reviews`, `sanctions`.
Khi thêm tính năng mới cho M05: thêm một dòng vào ma trận mục 2 (ID `TM-…`) cùng test tương ứng.

## 6. Việc ngoài phạm vi (ghi nhận)
- BC01–BC08 (báo cáo/thống kê): thuộc S3-M05-02/03.
- UC61/UC67/UC68 (bảo trì định kỳ, gửi lại email/đồng bộ lại quyết định) chưa gán chủ; test gọi trực tiếp use case.
