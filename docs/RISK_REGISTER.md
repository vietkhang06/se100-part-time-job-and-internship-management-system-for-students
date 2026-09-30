# CAMPUSJOB — SỔ THEO DÕI RỦI RO (RISK REGISTER)

| ID | Rủi ro tiềm ẩn | Mức độ | Khả năng | Tác động | Biện pháp giảm thiểu | Trạng thái |
|---|---|---|---|---|---|---|
| **RSK-01** | Xung đột cổng mạng với các container đang chạy trên máy phát triển | Cao | Rất cao | Gián đoạn dịch vụ khác, khởi động thất bại | Đổi cổng mặc định PostgreSQL sang 5435, Mailpit sang 1026/8026; kiểm tra cổng trước khi chạy. | Đã giải quyết |
| **RSK-02** | Rò rỉ thông tin bí mật (JWT secret, DB password) lên Git | Nghiêm trọng | Trung bình | Lộ bảo mật hệ thống khi công khai repository | Đưa `.env` vào `.gitignore`, cung cấp `.env.example` với giá trị mẫu an toàn, script CI dùng mock env. | Đã kiểm soát |
| **RSK-03** | Đụng độ dữ liệu giữa dự án mới và các volume database cũ | Cao | Cao | Làm sai lệch dữ liệu hoặc hỏng schema của dự án khác | Đặt tên Docker Compose project rõ ràng `campusjob-official`, không đặt volume name cố định để Docker tự namespace theo project. | Đã giải quyết |
| **RSK-04** | Lạm quyền và tài khoản Admin không được kiểm soát | Cao | Thấp | Nguy cơ bảo mật tài khoản quản trị | Không tự động tạo tài khoản Admin khi start server; chỉ tạo qua CLI `pnpm admin:create` với xác thực an toàn. | Đã kiểm soát |
| **RSK-05** | Tái sử dụng Refresh Token bị đánh cắp | Cao | Trung bình | Chiếm đoạt phiên đăng nhập của người dùng | Áp dụng cơ chế Token Family: khi phát hiện một token trong chuỗi bị tái sử dụng, lập tức vô hiệu hóa toàn bộ phiên liên quan. | Đã thiết kế |
