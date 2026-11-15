# M01 · Quản trị tài khoản và quyền kiểm duyệt

Các endpoint dưới đây nằm dưới `/api/v1` và yêu cầu access token của tài khoản ADMIN đang ACTIVE.

| Method và đường dẫn | Đầu vào | Kết quả |
|---|---|---|
| `GET /admin/users` | `search` theo tên/email, `role`, `status`, `page` (mặc định 1), `pageSize` (mặc định 20, tối đa 100) | `200 { items, total, page, pageSize }` |
| `GET /admin/users/:id` | UUID người dùng | `200` với thông tin tài khoản hoặc `404` |
| `PATCH /admin/users/:id/status` | `{"status":"SUSPENDED"}`, `{"status":"ACTIVE"}` hoặc `{"status":"LOCKED"}` | `200` với tài khoản sau cập nhật. Chuyển trạng thái sai trả `409`. |
| `PATCH /admin/users/:id/moderator` | `{"enabled":true}` hoặc `{"enabled":false}` | `200` với tài khoản sau cập nhật. Trạng thái hoặc hàng đợi không phù hợp trả `409`. |

Response tài khoản gồm `id`, `email`, `fullName`, `role`, `status`, `emailVerifiedAt`, `createdAt` và `updatedAt`. Thiếu hoặc sai token trả `401`. Vai trò khác ADMIN trả `403`. Tham số sai, field không thuộc DTO hoặc UUID sai định dạng trả `400`. Admin không thể dùng các endpoint ghi này để sửa tài khoản ADMIN, kể cả chính mình.

## Trạng thái và phiên đăng nhập

- `ACTIVE → SUSPENDED`, `ACTIVE → LOCKED`, `SUSPENDED → ACTIVE` và `SUSPENDED → LOCKED` là các chuyển trạng thái hợp lệ.
- `PENDING_VERIFICATION` được kích hoạt qua luồng xác minh email. `LOCKED` là trạng thái kết thúc theo `ROLES_AND_STATES.md`.
- Khi chuyển sang `SUSPENDED` hoặc `LOCKED` qua API quản trị, giao dịch thu hồi refresh session và tăng phiên bản JWT. Access token trả `403` theo trạng thái hiện tại. Refresh cookie đã thu hồi đi theo mã lỗi `401 REFRESH_TOKEN_REUSED` của luồng refresh hiện hành.
- Khi mở lại tài khoản bị đình chỉ, người dùng cần đăng nhập lại. Access token được cấp trước lúc đình chỉ trả `401`.

## Cấp và thu hồi MODERATOR

- Chỉ cấp cho tài khoản `STUDENT` hoặc `EMPLOYER` đang ACTIVE. Vai trò gốc được lưu để khôi phục khi thu hồi.
- ADMIN có thể nhận lại mục đang chờ bằng `POST /moderation/items/:id/claim`. Nếu moderator còn giữ mục `PENDING`, API thu hồi trả `409` cho đến khi mục được xử lý hoặc Admin nhận lại.
- Vai trò hiệu lực được lấy từ DB mỗi request qua JWT strategy. Sau khi cấp hoặc thu hồi, request kế tiếp dùng quyền theo vai trò hiện tại.
- Moderator có từ trước migration và chưa có vai trò gốc đã xác minh cần được đối chiếu dữ liệu lịch sử trước khi thu hồi. API trả `409` cho trường hợp này.

## AuditLog

Các action gồm `USER_STATUS_CHANGED`, `MODERATOR_ROLE_GRANTED` và `MODERATOR_ROLE_REVOKED`. Mỗi dòng ghi `actorId`, `entityType=USER`, `entityId`, `createdAt` và metadata chứa đúng cặp giá trị trước/sau. Việc ghi audit và thay đổi tài khoản dùng chung transaction. Gửi lại cùng trạng thái đã đạt không tạo thêm dòng audit.
