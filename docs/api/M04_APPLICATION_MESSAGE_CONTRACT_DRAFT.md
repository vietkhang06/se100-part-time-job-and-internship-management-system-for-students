# 1. S3-M04-02 — Application Message Contract và Message Flow

**DRAFT — chưa được Owner/PM phê duyệt triển khai.** Ngày đối chiếu 23/10/2026. Owner M04: Gia Khang; reviewer task: Việt Khang (theo workbook). Chưa ghi nhận người duyệt hoặc ngày duyệt. Tài liệu này không tạo Contract ID mới.

## 1.1. Căn cứ và cổng phạm vi

Workbook “Nhóm 11 (2).xlsx”:
- Module 4 - Gia Khang, hàng 31: phải chốt quyền sở hữu và scope/contract trước code; chưa duyệt thì task giữ “chưa làm”.
- Danh sách Use Case Gốc, hàng 98–99: UC69 xem lịch sử và UC70 gửi tin trong application.
- Danh Sách Usecase sau sửa, hàng 34: nhóm thành UC33; chỉ người tham gia đúng application.
- Contract C-01: M01 → M04, danh tính/role; kiểm tra owner tại backend.
- C-10: M04 → M05 chỉ khi notification được chốt.

Repository DECISION_LOG.md ADR-012 đang chấp thuận messaging thuộc Phase 2; README/SCOPE_AND_REQUIREMENTS cũng liệt kê messaging/realtime trong Phase 2. Chưa tìm thấy quyết định đưa message theo application vào Sprint 3 đã duyệt. Việc task có trạng thái “Đang làm” hoặc UC33 có trạng thái “Đã nhóm” không chứng minh đã phê duyệt scope.

**Đề xuất trình duyệt:** giao M04 sở hữu lịch sử/gửi message văn bản trong application, bổ sung ngoại lệ rõ ràng cho ADR-012 đối với UC33; realtime/chat toàn hệ thống tiếp tục ngoài scope. Đây là đề xuất, không phải quyết định thay Owner/PM.

## 1.2. Quyền và ranh giới

| Thành phần | Trách nhiệm đề xuất |
|---|---|
| M01 / C-01 | Cung cấp AuthContext chuẩn, trạng thái tài khoản, role; dùng JWT/guards hiện có |
| M04 | Lưu/đọc message theo applicationId, kiểm tra người tham gia mỗi request |
| M03 / C-07 | Cung cấp quan hệ employer thực sự quản lý job; M04 không tự đọc DB M03 hoặc suy ra quyền từ role |
| M05 / C-10 nếu duyệt | Nhận event đã thống nhất; chưa mặc định có notification |

Student chỉ đọc/gửi trong application của mình. Employer chỉ đọc/gửi trong application thuộc job mà actor thực sự quản lý. Người ngoài, Student khác, Employer doanh nghiệp khác không đọc/gửi được. Moderator/Admin không mặc nhiên có quyền xem nội dung riêng tư nếu chưa có quyền nghiệp vụ được duyệt.

## 1.3. Dữ liệu đề xuất và quyết định còn mở

Message có: messageId, applicationId, senderUserId, nội dung văn bản, sentAt do server đặt. Backend lấy senderUserId từ AuthContext, không tin trường sender do client gửi.

Cần Owner/PM chốt trước implementation: tên trường DTO; nội dung rỗng/whitespace và chuẩn hóa; giới hạn độ dài; pagination/order/cursor; cho gửi sau khi application rút/kết thúc hay không; retention; cơ chế retry gửi message. Chưa đề xuất attachment, chỉnh sửa/xóa, typing indicator, read receipt, websocket hoặc conversation ngoài application.

StudentId trong Application hiện nhận CurrentUser.id nhưng snapshot M02 dùng StudentProfile.id: phải thống nhất namespace identity khi bind adapter, không dùng hai namespace để xét quyền lẫn nhau.

## 1.4. API và response đề xuất để duyệt

Theo M04Controller hiện có, các route ứng viên tách /applications/me/:id và employer /employer/applications/:id. Đề xuất sử dụng cùng convention:

| Method | Route đề xuất dưới /api/v1 | Actor | Ý nghĩa |
|---|---|---|---|
| GET/POST | /applications/me/:id/messages | Student sở hữu | Xem lịch sử / gửi |
| GET/POST | /employer/applications/:id/messages | Employer quản lý job | Xem lịch sử / gửi |

Đây là route draft, chưa có controller hay endpoint được bật. Hai mặt API dùng chung applicationId và lịch sử, không tạo hai cuộc trò chuyện. Request gửi chỉ chứa nội dung đã được duyệt; response chỉ trả message trong application được phép đọc. Pagination, tên DTO, tên trường response và HTTP success cần duyệt cùng conventions hiện tại.

Theo JwtAuthGuard/RolesGuard và M04ExceptionFilter hiện hành: chưa xác thực → 401, sai role → 403; application không tồn tại/Student không sở hữu → 404; Employer không quản lý job → lỗi ownership theo contract hiện hành; body không hợp lệ → 400. Cần chốt chính sách không lộ tài nguyên khi chuẩn hóa contract message. Không gán error code mới chưa duyệt.

## 1.5. Luồng đề xuất

**Xem lịch sử:** xác thực → role → lấy application → kiểm tra Student owner hoặc gọi Job ownership API → truy vấn message chỉ theo applicationId đã được phép → trả trang lịch sử ổn định.

**Gửi:** xác thực → role → application tồn tại → ownership → validation theo policy đã duyệt → server đặt sender/time → lưu message gắn application → trả message. Lỗi trước khi commit không tạo message. Không log token/nội dung riêng tư.

**Notification (chờ quyết định riêng):** tài liệu C-20 Notification hiện DRAFT, chưa có message event. Không tự thêm eventType/recipient/payload/dedupeKey. Nếu bật, Owner M04/M05 phải chốt: ánh xạ C-10↔C-20; người nhận phía đối diện (nhóm HR hay một người cụ thể); event identity ổn định; thời điểm publish sau commit; xử lý retry và khi publish thất bại; payload tối thiểu không lộ nội dung. C-15 chưa có định nghĩa độc lập được duyệt trong repo.

## 1.6. Ma trận nghiệm thu sau phê duyệt

Tất cả case hiện NOT IMPLEMENTED / BLOCKED BY SCOPE APPROVAL; chưa có test thực thi chức năng nhắn tin.

| ID | Tiền điều kiện / thao tác | Kết quả mong đợi cần kiểm chứng |
|---|---|---|
| MSG01 | Student sở hữu gửi, Employer quản lý đọc | Cùng applicationId; sender đúng actor; nội dung đã lưu |
| MSG02 | Employer quản lý gửi, Student sở hữu đọc | Lịch sử hai chiều cùng application |
| MSG03 | Student khác đọc/gửi | Không đọc được dữ liệu, không tạo message |
| MSG04 | Employer khác doanh nghiệp đọc/gửi | Không đọc được dữ liệu, không tạo message |
| MSG05 | Chưa login, tài khoản không hợp lệ hoặc sai role | Bị từ chối theo C-01 |
| MSG06 | applicationId không tồn tại | Không tạo message mồ côi |
| MSG07 | Client giả mạo sender hoặc trường hệ thống | Bị validation từ chối hoặc server bỏ qua theo contract được duyệt; không mạo danh |
| MSG08 | Body rỗng/quá giới hạn, phân trang/lịch sử | Expected chi tiết chỉ chốt khi policy được duyệt |
| MSG09 | Retry gửi hoặc application kết thúc | Expected chưa chốt; không tự suy ra idempotency/policy gửi |
| MSG10 | Notification nếu được duyệt | Đúng recipient, không trùng theo event identity; không lộ nội dung |

## 1.7. Phiếu quyết định cần Owner/PM và module liên quan chốt

| Nội dung | Trạng thái |
|---|---|
| Đưa UC69–UC70 / UC33 vào Sprint 3, giao M04 sở hữu; điều chỉnh ADR-012 | Chờ Owner/PM |
| API/DTO, identity mapping, ownership qua C-01/C-07 | Chờ M01/M03/M04 và reviewer |
| Validation, giới hạn, phân trang, terminal-state policy, retention/retry | Chờ Owner/PM |
| Notification bật hay tắt; nếu bật chốt C-10/M05 payload và recipient | Chờ Owner/PM + M05 |
| Người duyệt/ngày/link bằng chứng | Chưa có |

Sau khi duyệt: ghi quyết định thật, cập nhật scope/traceability/contract registry, triển khai schema/migration/service/controller/UI theo phạm vi được duyệt, chạy test MSG01–MSG10 trên PostgreSQL với auth/ownership thật. Trước thời điểm đó S3-M04-02 chưa hoàn thành implementation.
