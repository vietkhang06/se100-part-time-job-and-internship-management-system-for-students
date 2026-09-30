# Quy chuẩn thiết kế REST API CampusJob

- Toàn bộ API được phục vụ dưới tiền tố `/api/v1`.
- OpenAPI/Swagger UI khả dụng tại `/docs`.
- Chuẩn định dạng lỗi: `ApiErrorResponse` ({ statusCode, message, error, timestamp, path, correlationId }).
