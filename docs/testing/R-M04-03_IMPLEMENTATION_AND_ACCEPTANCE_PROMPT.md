# Prompt triển khai và nghiệm thu đầy đủ R-M04-03

Bạn là Senior Engineer kiêm QA của CampusJob. Mục tiêu là đưa Matching Score và HR candidate sorting vào **production path**, có bằng chứng nghiệm thu. Gia Khang đã phê duyệt phương án M04 trong chat ngày 28/11/2026; kiểm tra chính xác phạm vi quyết định, không tự ghi Owner/PM hoặc M02/M03 đã duyệt. Đọc specification `C:\Users\khang\Downloads\R-M04-03_MATCHING_SCORE_SPECIFICATION.md`, `docs/decisions/M04_MATCHING_SCORE_PROPOSAL.md`, `docs/testing/R-M04-03_VERIFICATION_PROMPT.md`, báo cáo kiểm thử hiện có và mọi `AGENTS.md` áp dụng. Nếu tài liệu mâu thuẫn, ưu tiên yêu cầu người dùng và chứng cứ ở HEAD; ghi rõ quyết định còn thiếu.

## Quy trình bắt buộc

1. Ghi branch/HEAD/working tree; bảo toàn thay đổi chưa commit, không dùng production data, không reset DB. Đọc package scripts và kỹ năng thực có. Truy vết cả caller, port, DTO, migration, repo, API client, UI, test trước khi sửa.
2. Lập bảng nguồn dữ liệu cho CV skill IDs, trạng thái `missing`/`confirmed empty`, alias catalog và version, job required/preferred skill IDs, industry, requirements revision. M02/M03 sở hữu dữ liệu và adapter; M04 chỉ dùng contract. Không so chuỗi tên hiển thị như canonical ID, không suy luận synonym, không chuyển `null` thành `[]` hoặc dùng job hiện tại để hồi tố điểm hồ sơ cũ.
3. Viết test thất bại theo MS-01–MS-32 cho các nhánh có đủ contract. Scorer pure/stateless: 80/20 khi preferred không rỗng, required 100% khi preferred rỗng hợp lệ, 0–100, half-up 1 decimal, dedup và required ưu tiên overlap, industry không ảnh hưởng, cùng input/version cùng kết quả. Missing, invalid, empty và valid zero phải khác nhau. Alias chỉ qua catalog duy nhất versioned; không fuzzy/LLM.
4. Bổ sung contract M02/M03 tối thiểu và migration additive nếu cần: skill IDs và provenance; required/preferred, job revision; snapshot ở thời điểm submit; persisted result/reason/formula/mapping version/calculatedAt. Đảm bảo transaction/idempotency, không bypass ownership/eligibility/quota/sanction. Application cũ thiếu snapshot là UNAVAILABLE, không backfill từ live job. Sửa CV/job về sau không đổi kết quả cũ.
5. Dùng endpoint HR hiện có. Thêm `sortBy=submittedAt|matchingScore`, giữ default và `sort` cũ. HR authorization trước khi đọc; score sort trên toàn tập đã được scope trước phân trang, AVAILABLE trước UNAVAILABLE, 0 là điểm thật; tie score theo createdAt DESC rồi ID ASC. Tránh trộn formula/mapping version không tương thích. Test nhiều page, tie, asc/desc, invalid params và HR khác công ty.
6. UI HR có sort time/score và direction, pagination, loading/error/empty; hiển thị reason UNAVAILABLE đúng, 0.0 đúng, explanation/version khi available, cảnh báo score chỉ tham khảo. Thao tác HR vẫn qua state machine; score không tự accept/reject/invite/đóng tin.
7. Chạy unit, contract, PostgreSQL test DB riêng, HTTP E2E bằng adapter thật, UI test/browser smoke; build contracts, generate Prisma, typecheck, lint, build, `git diff --check`. Ghi lệnh, exit code, số test, test data, limitation. Không coi mock là E2E. Chỉ đánh PASS khi thực thi.
8. Với mỗi FAIL: ghi expected/actual, root cause, file/dòng, severity; sửa gốc lỗi tối thiểu rồi chạy lại targeted và regression. Không thêm dependency nếu không cần. Tránh refactor ngoài task.
9. Cập nhật `reports/se100-task-verification/R-M04-03_MATCHING_SCORE_VERIFICATION.md` với ma trận MS-01–MS-32, approval evidence, schema/contract, API/UI, security, performance và verdict. DONE chỉ khi production path đầy đủ và mọi acceptance gate đạt. Nếu thiếu quyết định hay dữ liệu, nêu blocker cụ thể, giữ fallback UNAVAILABLE và không tuyên bố DONE.

## Definition of Done

- Specification và mapping/version có bằng chứng phê duyệt trong phạm vi cần thiết.
- Dữ liệu M02/M03 xác thực đi vào scorer; snapshot và score được lưu bất biến, versioned.
- HR có thể chọn sort theo time/score trên API và UI; ổn định qua pagination.
- Không có điểm giả, không có quyết định tuyển dụng tự động, không lộ hồ sơ khác công ty.
- MS-01–MS-32 có trạng thái và bằng chứng; các test bắt buộc PASS, CI/typecheck/build đạt.
