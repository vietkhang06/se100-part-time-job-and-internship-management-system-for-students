# Quy chuẩn thiết kế REST API CampusJob

- Toàn bộ API được phục vụ dưới tiền tố `/api/v1`.
- OpenAPI/Swagger UI khả dụng tại `/docs`.
- Chuẩn định dạng lỗi: `ApiErrorResponse` ({ statusCode, message, error, code, timestamp, path, correlationId }).

## Danh mục Hợp đồng API (API Contracts)
- [Hợp đồng API Xác thực C-01 (Auth API Contract)](./AUTH_API_CONTRACT.md)
- [Ma trận mã lỗi Xác thực (Auth Error Matrix)](./AUTH_ERROR_MATRIX.md)
