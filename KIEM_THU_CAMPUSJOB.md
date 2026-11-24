# Chạy CampusJob trên máy hiện tại

Bản source này đã gộp các thay đổi về chi nhánh, đăng tin, kiểm duyệt, xác thực doanh nghiệp và giao diện. Nếu bạn có thay đổi riêng trên máy, hãy giữ bản hiện tại và so sánh hai thư mục trước khi thay file.

Trong thư mục gốc có package.json, dùng lại cấu hình .env của dự án. Giữ nguyên tên project Docker Compose và volume khi muốn dùng dữ liệu cũ. Chạy trong PowerShell:

```powershell
pnpm install --frozen-lockfile
pnpm infra:up
pnpm infra:ps
pnpm db:generate
pnpm db:deploy
pnpm dev
```

Web dùng http://localhost:3000 theo cấu hình mẫu. Mở ba phiên trình duyệt độc lập khi kiểm thử Sinh viên, Nhà tuyển dụng và Quản trị viên. Kiểm duyệt viên là quyền riêng nếu muốn phân công người duyệt. Nếu chưa có Admin, dùng email riêng với lệnh trong README mục tạo Admin.

| Người thực hiện | Thao tác | Điều kiện nghiệm thu |
| --- | --- | --- |
| HR | Tạo công ty, chi nhánh, chọn giấy phép PDF tại Hồ sơ công ty và gửi | Hồ sơ xuất hiện trong danh sách chờ của Admin |
| Admin | Vào Quản lý doanh nghiệp, tải giấy tờ để đối chiếu, xác thực hoặc yêu cầu bổ sung | Công ty được xác thực mới xuất hiện ở danh bạ công khai |
| HR | Tạo tin còn hạn và gửi kiểm duyệt | Tin chờ xử lý, chưa xuất hiện trong Tìm việc |
| Moderator hoặc Admin | Mở Kiểm duyệt tin, xem mô tả, chi nhánh, hạn nộp và quyết định | Phê duyệt hợp lệ mở tin và ghi quyết định trong một giao dịch PostgreSQL |
| Sinh viên | Tìm theo tên tin, xem mô tả, lưu tin, chọn CV và ứng tuyển | Có tin ở mục Tin đã lưu, có đơn ở Lịch sử ứng tuyển |
| HR và sinh viên | HR xem đơn và mời phỏng vấn, sinh viên phản hồi, HR ghi nhận kết quả | Đối chiếu thông tin ở cả hai phiên và kiểm tra Thông báo |
| HR | Sửa nội dung tin đã duyệt | Tin trở về Chờ duyệt, gửi kiểm duyệt lại trước khi xuất hiện công khai |
| Admin | Mở tài khoản, thống kê và nhật ký quản trị | Danh sách lấy từ API, có trạng thái lỗi khi tải thất bại |

Tin cũ đã có quyết định nhưng chưa được áp dụng có thể thử đồng bộ từ Trung tâm kiểm duyệt sau khi công ty được xác thực. Nếu nội dung tin đã sửa sau quyết định cũ, gửi duyệt lại để người duyệt xem phiên bản mới.

## Phạm vi kiểm thử

Đã chạy Jest API, Jest web, TypeScript và production build. Các kiểm thử dùng kho dữ liệu trong bộ nhớ hoặc mock không thay thế kiểm thử với PostgreSQL. Các bước ở bảng trên là kịch bản nghiệm thu với tài khoản và dữ liệu thật, chưa được đánh dấu đạt trong môi trường của bạn.
