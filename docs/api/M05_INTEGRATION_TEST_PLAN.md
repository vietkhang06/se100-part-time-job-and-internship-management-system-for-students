# S2-M05-06 — Trust Integration: kế hoạch kiểm thử xuyên module

> Liên kết: C-16 (kiểm duyệt), C-17 (báo cáo), C-18 (đánh giá), C-19 (chế tài), C-20 (thông báo), C-01/C-02 (tài khoản, phân quyền).
> File test: `apps/api/test/m05-trust-integration.e2e-spec.ts`.

## Cách chạy
```powershell
pnpm infra:up                      # chỉ cần Postgres; test KHÔNG cần Mailpit (email được thay bằng bộ gửi giả)
pnpm db:migrate
pnpm --filter @campusjob/api test:e2e m05-trust-integration
```
Cần branch đã có cả 5 module M05 (notifications, moderation, reports, reviews, sanctions). Test tự tạo người dùng có tiền tố `m05i-` và tự dọn khi xong.

## Tiêu chí nghiệm thu ↔ kịch bản
| Tiêu chí (sheet) | Kịch bản | Cách kiểm |
|---|---|---|
| Luồng báo cáo → kiểm duyệt → chế tài → thông báo chạy xuyên module | **A** | Nhà tuyển dụng báo cáo sinh viên → Kiểm duyệt viên nhận xử lý và kết luận có căn cứ → Admin khóa ứng tuyển → thông báo và email → sinh viên thấy chế tài, M04 đọc được trạng thái khóa → Admin gỡ |
| | **E, H** | Email lỗi không mất sự kiện; đình chỉ doanh nghiệp qua handler M03 |
| Không tạo quyết định trùng | **A** (kết luận, áp chế tài, gỡ), **B1, B2**, **C2**, **G** | Quyết định/chế tài/đóng báo cáo lần hai bị 409 và không ghi thêm dòng; hai người thao tác cùng lúc chỉ một người thành công |
| Không tạo thông báo trùng | **A**, **B2, B3**, **C2**, **G** | Đếm `Notification` và email theo người nhận sau mỗi thao tác lặp; phát lại cùng `dedupeKey` chỉ lưu một lần |
| Đúng người nhận | **A**, **C2**, **H**, **G** | Người bị chế tài, người báo cáo, chủ doanh nghiệp, nhà tuyển dụng nhận đúng loại; người không liên quan không nhận gì |
| Chế tài phải có căn cứ xác nhận | **A**, **C1** | Báo cáo chưa kết luận hoặc đã bị bác bỏ thì không áp chế tài |
| Phân quyền | **A** | Chỉ Moderator/Admin xem hàng đợi và báo cáo; chỉ Admin áp chế tài; Moderator chỉ xử lý mục được giao |
| Ngưỡng, thời hạn, không chồng chế tài | **D** | 3 cảnh cáo thì buộc khóa; khóa chỉ trong 1–90 ngày; không khóa chồng |
| Đánh giá và kiểm duyệt đánh giá | **F** | Chỉ đánh giá sau trạng thái cuối, một đánh giá/hồ sơ, phản hồi một lần, ẩn danh công khai, ẩn/khôi phục qua kiểm duyệt, "duyệt lại" tạo vòng mới |

## Ranh giới: cái gì thật, cái gì giả
- **Thật:** `AppModule`, PostgreSQL, JWT/phân quyền (M01) và cả 5 module M05.
- **Giả (đối tượng test theo đúng contract):**
  - bộ gửi email (ghi lại thư để kiểm tra người nhận và mô phỏng lỗi SMTP);
  - M03: `ICompanyDirectory`, `ICompanySanctionHandler`, resolver báo cáo `COMPANY`, handler kiểm duyệt `JOB`;
  - M04: `IApplicationReviewSource`.
  M03 và M04 chưa nối vào `AppModule`. Khi họ nối thật, thay các đối tượng giả này bằng adapter thật và chạy lại cùng kịch bản.

## Chưa được kiểm thử ở đây
- Việc M04 thật sự gọi `ISanctionQuery` khi nộp hồ sơ (cần M04 làm); test chỉ kiểm cổng trả đúng trạng thái khóa.
- Giao diện (chưa có test FE).
- Job định kỳ gửi lại email/đồng bộ lại quyết định (UC61/UC68 chưa gán chủ); test gọi trực tiếp use case gửi lại và đồng bộ lại.
