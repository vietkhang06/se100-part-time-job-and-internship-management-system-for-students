# CAMPUSJOB — PHẠM VI DỰ ÁN

## 1. Mục tiêu

CampusJob là hệ thống kết nối sinh viên với doanh nghiệp có nhu cầu tuyển dụng việc làm thêm, thực tập và vị trí dành cho sinh viên.

## 2. Tác nhân

- Khách
- Sinh viên
- Nhà tuyển dụng
- Kiểm duyệt viên
- Quản trị viên
- Hệ thống email
- Dịch vụ lưu trữ tệp
- Bộ lập lịch vận hành

## 3. Phạm vi cốt lõi

- Đăng ký và xác minh email.
- Đăng nhập, đăng xuất và khôi phục mật khẩu.
- Phân quyền Student, Employer, Moderator và Admin.
- Hồ sơ cá nhân và xác thực email trường.
- Quản lý CV.
- Hồ sơ doanh nghiệp và chi nhánh.
- Duyệt doanh nghiệp.
- Tạo và kiểm duyệt tin tuyển dụng.
- Tìm kiếm, lọc và xem việc làm.
- Lưu và gợi ý việc làm.
- Ứng tuyển bằng CV snapshot.
- Quản lý trạng thái hồ sơ ứng tuyển.
- Quản lý phỏng vấn.
- Đánh giá doanh nghiệp.
- Báo cáo và xử lý vi phạm.
- Thông báo trong hệ thống và email.
- Quản lý người dùng, thống kê và audit log.
- Upload và quản lý tệp có kiểm soát quyền sở hữu.
- Bảo trì định kỳ.

## 4. Phạm vi giai đoạn 2

- Nhắn tin trực tiếp theo hồ sơ ứng tuyển.
- Gói dịch vụ trả phí.
- Stripe Checkout.
- Tin tuyển dụng nổi bật.
- Các chức năng thương mại hóa khác.

## 5. Ngoài phạm vi

- ChatGPT SSO.
- Cloudflare D1 và R2.
- WebMCP Search.
- Ứng dụng di động native.
- Video call tích hợp trong hệ thống.
- Mạng xã hội tuyển dụng.
- Tự động tuyển dụng không có con người phê duyệt.

## 6. Nguyên tắc

- PostgreSQL là nguồn dữ liệu chính.
- Frontend không truy cập trực tiếp cơ sở dữ liệu.
- Mọi nghiệp vụ đi qua REST API.
- Không sử dụng mock API trong luồng production.
- Không tự động seed dữ liệu production.
- Quản trị viên đầu tiên được tạo bằng CLI.
- Mọi thay đổi trạng thái quan trọng phải có audit log.