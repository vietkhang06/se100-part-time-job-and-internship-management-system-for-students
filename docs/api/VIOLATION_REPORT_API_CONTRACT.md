# C-17 — Violation Report Contract (M05) — DRAFT

> Owner: Minh Phương (M05). Task: S2-M05-02. UC (tab Danh sách Use Case): UC48, UC49, UC52 (qua C-16), UC59 (S2-M05-04).

## 1. Luồng

```
Người dùng gửi báo cáo (UC49)
  → kiểm tra quyền theo loại đối tượng → kiểm tra đối tượng tồn tại → chặn tự báo cáo → chặn báo cáo trùng
  → lưu báo cáo (SUBMITTED) + gửi thông báo REPORT_RECEIVED
  → enqueue sang hàng chờ kiểm duyệt (C-16, targetType=REPORT) → UNDER_REVIEW
  → Moderator thẩm tra (UC52): SUBSTANTIATED | DISMISSED (kết luận sơ bộ)
  → (S2-M05-04) Admin phán quyết (UC59): áp chế tài hoặc đóng không xử phạt → RESOLVED
```

Nếu enqueue lỗi, báo cáo vẫn được lưu và ở trạng thái SUBMITTED (không mất).

Trạng thái: `SUBMITTED` → `UNDER_REVIEW` → `SUBSTANTIATED` hoặc `DISMISSED` (kết luận sơ bộ) → `RESOLVED` (phán quyết cuối của Admin, chỉ đi từ `SUBSTANTIATED`). `RESOLVED` không bao giờ bị hạ về trạng thái sơ bộ, kể cả khi quyết định kiểm duyệt được đồng bộ lại.

**Báo cáo về đánh giá (UC53):** ngoài mục REPORT, hệ thống đưa thêm một mục REVIEW vào hàng chờ kiểm duyệt để Kiểm duyệt viên ẩn/khôi phục đánh giá đó (xử lý bởi S2-M05-03).

## 2. Ai báo cáo được gì (DRAFT)

| Vai trò | Đối tượng được báo cáo |
|---|---|
| Sinh viên | COMPANY, JOB, REVIEW |
| Nhà tuyển dụng | STUDENT, REVIEW |

Sai loại → 400 `REPORT_TARGET_NOT_ALLOWED`. Tự báo cáo chính mình → 400 `REPORT_SELF_TARGET`.

## 3. Kiểm tra đối tượng

M05 không đọc bảng của module khác. Module sở hữu đối tượng đăng ký resolver:

```ts
reportTargetResolverRegistry.register(ViolationTargetType.COMPANY, {
  async resolve(targetId) { return exists ? { ownerUserId, label } : null; },
});
```

- `STUDENT`: M05 tự xử lý qua `IUserRepository` (M01).
- `COMPANY`, `JOB`: **chờ M03 đăng ký resolver**. `REVIEW`: do S2-M05-03 đăng ký (module `reviews`).
- Loại chưa có resolver → **fail-closed** 503 `REPORT_TARGET_UNAVAILABLE` (không nhận báo cáo mù).
- Không tồn tại → 404 `REPORT_TARGET_NOT_FOUND`.

## 4. Chống trùng

Một người chỉ có **một báo cáo đang mở** cho mỗi đối tượng (`openKey` unique ở DB). Trùng → 409 `REPORT_DUPLICATE`. Sau khi báo cáo có kết luận, `openKey` được giải phóng nên có thể báo cáo lại nếu có vi phạm mới.

## 5. Bằng chứng

- Tối đa 5 mục, mỗi mục là URL `http/https` (tối đa 2000 ký tự) kèm ghi chú tùy chọn.
- **Chưa hỗ trợ tệp tải lên** vì chưa có dịch vụ lưu trữ (UC64–66). Schema đã có chỗ cho `storageKey/fileName`.
- Báo cáo không có bằng chứng vẫn được tiếp nhận nhưng hàng chờ gắn nhãn "chưa có bằng chứng" để người thẩm tra cân nhắc.

## 6. Thiếu căn cứ thì không tự áp chế tài

Module báo cáo **không có đường nào gọi chế tài**: kết luận UC52 chỉ đổi trạng thái báo cáo (`ReportModerationTargetHandler`). Chế tài là quyết định riêng của Admin (UC59).

## 7. REST API (prefix `/api/v1`)

| Method | Path | Vai trò | Mô tả |
|---|---|---|---|
| POST | `/reports` | Student, Employer | UC49 — body `{ targetType, targetId, reason, description (20–2000 ký tự), evidence?[] }` |
| GET | `/reports/mine?page&limit` | Student, Employer | UC48 |
| GET | `/reports/:id` | Student, Employer | Chi tiết báo cáo của mình (người khác → 404) |
| GET | `/reports/review/:id` | Moderator, Admin | UC52 — đầy đủ báo cáo, bằng chứng, `reporterId` |

## 8. Cổng cho S2-M05-04 (chế tài)

`REPORT_ADMIN_TOKEN` (export từ `ReportsModule`): `findById`, `listByStatus`, `markResolved` (SUBSTANTIATED → RESOLVED). Module chế tài dùng cổng này, không đọc bảng báo cáo trực tiếp.

## 9. Giao diện (FE)

- `ViolationReportDialog` (UC49): nhúng vào trang doanh nghiệp/tin/hồ sơ ứng viên/đánh giá bằng cách truyền `targetType` + `targetId`.
- `/candidate/reports`, `/employer/reports` (UC48): báo cáo đã gửi.