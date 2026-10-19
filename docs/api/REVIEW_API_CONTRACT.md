# C-18 — Review Contract (M05) — DRAFT

> Trạng thái: **DRAFT**, chờ Lead, Owner M03/M04 xác nhận.
> Owner: Minh Phương (M05). Task: S2-M05-03. UC (tab Danh sách Use Case): UC45, UC46, UC47, UC53 (qua C-16).

## 1. Quy tắc

| Quy tắc | Cách thực hiện |
|---|---|
| Chỉ đánh giá sau trạng thái cuối | Hồ sơ ứng tuyển phải ở `ACCEPTED` hoặc `REJECTED`. `WITHDRAWN` (sinh viên tự rút) và các trạng thái đang xử lý bị từ chối: 409 `REVIEW_NOT_ELIGIBLE` |
| Mỗi hồ sơ một đánh giá | `applicationId` UNIQUE: trùng → 409 `REVIEW_ALREADY_EXISTS` (kể cả khi hai request chạy song song) |
| Chỉ đánh giá hồ sơ của mình | Adapter của M04 chỉ trả hồ sơ thuộc sinh viên; còn lại → 404 `REVIEW_APPLICATION_NOT_FOUND` |
| Số sao | Số nguyên 1–5, nhận xét tối đa 2000 ký tự (không bắt buộc) |
| Phản hồi đúng một lần | `ReviewReply.reviewId` UNIQUE: lần hai → 409 `REVIEW_ALREADY_REPLIED` |
| Chỉ doanh nghiệp được đánh giá mới phản hồi | Đánh giá của doanh nghiệp khác hoặc đã bị ẩn → 404 `REVIEW_NOT_FOUND` (không lộ sự tồn tại) |
| Dữ liệu công khai | Chỉ đánh giá `VISIBLE`; người viết **ẩn danh** (không có `studentId`/tên); kèm điểm trung bình (làm tròn 1 chữ số) và phân bố số sao |
| Ẩn/khôi phục | Quyết định HIDE/RESTORE từ hàng chờ kiểm duyệt (UC53) đổi `visibility` |

## 2. Cổng để M03/M04 nối vào

`ReviewSourcesRegistry` (export từ `ReviewsModule`). Chưa đăng ký → tạo/xem/phản hồi đánh giá trả **503** `REVIEW_SOURCE_UNAVAILABLE` (fail-closed, không đoán).

```ts
// M04: hồ sơ ứng tuyển CỦA CHÍNH sinh viên (có thể dựa trên M04Workflow.getMine)
registry.registerApplicationSource({
  async getOwnedApplication(studentId, applicationId) { return { applicationId, jobId, status } | null; },
});

// M03: ánh xạ tin tuyển dụng / nhà tuyển dụng sang doanh nghiệp
registry.registerCompanyDirectory({
  async findByJob(jobId) { return { companyId, companyName, ownerUserId } | null; },
  async findByEmployer(employerUserId) { return { companyId, companyName, ownerUserId } | null; },
});
```

`ReviewsModule` tự đăng ký: handler kiểm duyệt cho `REVIEW` (HIDE/RESTORE) và resolver cho báo cáo `REVIEW` (C-17).

## 3. REST API (prefix `/api/v1`)

| Method | Path | Vai trò | Mô tả |
|---|---|---|---|
| POST | `/reviews` | Student | UC46 — `{ applicationId, rating, comment? }` |
| GET | `/reviews/mine?page&limit` | Student | Đánh giá tôi đã viết (kể cả đã bị ẩn) |
| GET | `/reviews/employer?page&limit` | Employer | UC45 — đánh giá của doanh nghiệp mình, kèm thống kê |
| GET | `/reviews/company/:companyId?page&limit` | Công khai | Đánh giá công khai của một doanh nghiệp |
| POST | `/reviews/:id/reply` | Employer | UC47 — `{ content }` (một lần) |

## 4. Giao diện (FE)

- `ReviewFormDialog` (UC46): nhúng vào trang Lịch sử ứng tuyển cho các hồ sơ đã có kết quả cuối, truyền `applicationId`.
- `/employer/reviews` (UC45, UC47): thống kê, danh sách, nút Phản hồi.
- `/candidate/reviews`: đánh giá của tôi.
- `ReviewSummaryCard` + `ReviewItems`: dùng cho trang doanh nghiệp công khai (M03) qua `listCompanyReviews`.
