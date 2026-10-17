# C-16 — Moderation Contract (M05) 

> Owner: Minh Phương (M05). Task: S2-M05-01. UC (tab Danh sách Use Case): UC50, UC51, UC52, UC53.

## 1. Đối tượng kiểm duyệt

| targetType | Chủ sở hữu | UC | Quyết định cho phép | Lý do bắt buộc |
|---|---|---|---|---|
| JOB | M03 | UC51 | APPROVE, REJECT, HIDE | REJECT, HIDE |
| REVIEW | M05-03 | UC53 | HIDE, RESTORE | HIDE |
| REPORT | M05-02 | UC52 | SUBSTANTIATE, DISMISS (kết luận **sơ bộ**, kèm `proposedAction` tùy chọn) | Cả hai |

UC52 chỉ là kết luận sơ bộ và đề xuất. Chế tài là quyết định riêng của Quản trị viên (UC59, S2-M05-04).

## 2. State rule

```
PENDING --APPROVE--> APPROVED      PENDING --SUBSTANTIATE--> SUBSTANTIATED
PENDING --REJECT---> REJECTED      PENDING --DISMISS-------> DISMISSED
PENDING --HIDE-----> HIDDEN        PENDING --RESTORE-------> RESTORED
```

- Mỗi lần nội dung vào hàng chờ là một **vòng (round)**. "Duyệt lại" = enqueue lại sau khi vòng trước đã có quyết định → tạo round mới, giữ nguyên lịch sử.
- Enqueue khi vòng gần nhất còn PENDING → trả `ALREADY_PENDING`, không tạo trùng.
- Quyết định chỉ ghi được khi item còn PENDING (chống hai người quyết định cùng lúc → 409).

## 3. Phân quyền xử lý

- Chỉ `MODERATOR` và `ADMIN` gọi được API `/moderation/*`.
- `POST /moderation/items/:id/claim` giao mục cho người nhận. Mục đã giao cho người khác thì Moderator không quyết định được (403 `MODERATION_NOT_ASSIGNED`); Admin được can thiệp.
- Mục chưa ai nhận: người đầu tiên quyết định trở thành người phụ trách.

## 4. Cho module khác dùng (in-process)

**Đưa nội dung vào hàng chờ** — inject `MODERATION_QUEUE_TOKEN`:

```ts
enqueue({ targetType, targetId, submitterId?, summary? }): Promise<{ itemId, round, outcome }>
```

**Nhận quyết định** — đăng ký handler của module mình (thường trong `onModuleInit`), M05 không tự ghi vào bảng của module khác:

```ts
registry.register(ModerationTargetType.JOB, {
  async applyDecision(ctx) { /* cập nhật trạng thái Job theo ctx.decision / ctx.newStatus */ },
});
```

- Handler phải **idempotent**.
- Quyết định luôn được lưu trước. Nếu chưa có handler hoặc handler lỗi, quyết định được đánh dấu chưa đồng bộ (`targetSynced=false`) và có thể áp lại bằng `ResyncModerationDecisionsUseCase`.
- Với JOB, M05 tự gửi thông báo `JOB_APPROVED` / `JOB_REJECTED` / `JOB_HIDDEN` cho `submitterId` (C-20), kèm `jobTitle` lấy từ `summary` lúc enqueue.

## 5. REST API (prefix `/api/v1`)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/moderation/queue?status&targetType&assignedToMe&page&limit` | UC50 — mặc định `status=PENDING`, cũ nhất trước |
| GET | `/moderation/items/:id` | Chi tiết và lịch sử quyết định |
| POST | `/moderation/items/:id/claim` | Nhận xử lý |
| POST | `/moderation/items/:id/decision` | UC51/52/53 — body `{ decision, reason?, proposedAction? }` |

Mã lỗi: `MODERATION_ITEM_NOT_FOUND` (404), `MODERATION_DECISION_NOT_ALLOWED` / `MODERATION_REASON_REQUIRED` / `MODERATION_PROPOSED_ACTION_NOT_ALLOWED` (400), `MODERATION_NOT_ASSIGNED` (403), `MODERATION_ALREADY_DECIDED` / `MODERATION_ALREADY_ASSIGNED` (409).

Mỗi quyết định ghi `AuditLog` (`MODERATION_<DECISION>`).

## 6. Câu hỏi mở

1. Tên trạng thái Job của M03 có khớp `APPROVED / REJECTED / HIDDEN` không? Cần để M03 viết handler.
2. Có thêm quyết định "yêu cầu sửa" (SSD-07 có, UC51 không có) không?
3. UC56 (xét duyệt doanh nghiệp): Quản trị viên (Danh sách UC) hay Kiểm duyệt viên (RBAC_MATRIX)? Chưa đưa vào C-16 cho tới khi chốt.
