# Quy chuẩn thiết kế REST API CampusJob

- Toàn bộ API được phục vụ dưới tiền tố `/api/v1`.
- OpenAPI/Swagger UI khả dụng tại `/docs`.
- Chuẩn định dạng lỗi: `ApiErrorResponse` ({ statusCode, message, error, code, timestamp, path, correlationId }).

## Danh mục Hợp đồng API (API Contracts)
- [Hợp đồng API Xác thực C-01 (Auth API Contract)](./AUTH_API_CONTRACT.md)
- [Ma trận mã lỗi Xác thực (Auth Error Matrix)](./AUTH_ERROR_MATRIX.md)
- [Ma trận phân quyền vai trò RBAC (RBAC Matrix)](./RBAC_MATRIX.md)
- [Ma trận trạng thái tài khoản (Account State Matrix)](./ACCOUNT_STATE_MATRIX.md)
- [Hợp đồng API Hồ sơ sinh viên C-03/C-05 (Student Profile Contract)](./STUDENT_PROFILE_API_CONTRACT.md)
- [Ma trận mã lỗi Hồ sơ sinh viên (Student Profile Error Matrix)](./STUDENT_PROFILE_ERROR_MATRIX.md)
- [Hợp đồng API Quản lý CV C-03/C-04/C-05 (CV & Resume API Contract)](./CV_API_CONTRACT.md)
- [Ma trận mã lỗi Quản lý CV (CV Error Matrix)](./CV_ERROR_MATRIX.md)

