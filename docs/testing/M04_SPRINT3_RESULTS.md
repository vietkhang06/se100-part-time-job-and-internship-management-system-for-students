# 1. Kết quả thực hiện S3-M04-01

Đối chiếu và thực thi ngày 23/10/2026, trong checkout 23-10-26. Git ban đầu sạch, nhánh main. Không chỉnh workbook hoặc liên lạc module owner.

## 1.1. S3-M04-01

Đã tạo ma trận E01–E15 trong M04_SPRINT3.md, mapping UC/contract, request, điều kiện, expected và blocker. Đã thêm 10 regression DB01–DB10 cho repository Prisma thật, cấu hình riêng và guard database test. Các test không mock M02/M03/M05; cũng không gọi các module này, nên không được tính là full integration.

Hiện chưa nghiệm thu S3-M04-01: thiếu Job eligibility/ownership API C-07 của M03; AppModule chưa bind M04; C-10/C-15 ↔ C-20 và state vocabulary chưa được chốt. M02 C-03 đã có tài liệu APPROVED / READY và adapter, nhưng phải thống nhất userId/ProfileId trước binding. Không tự sửa hợp đồng M02 hoặc M05.

## 1.2. Lệnh đã thực thi và bằng chứng

| Lệnh | Kết quả | Bằng chứng/giới hạn |
|---|---|---|
| pnpm install --frozen-lockfile | PASS | Cài dependency theo lockfile, không thay lockfile |
| pnpm db:generate / pnpm db:validate (lần đầu) | FAIL | P1012: SanctionEvent thiếu dấu đóng } trước enum ReviewVisibility |
| pnpm db:generate / pnpm db:validate (sau sửa) | PASS | Generated Prisma Client 6.19.3; schema valid |
| pnpm typecheck | PASS, exit 0 | logs/m04-typecheck.log |
| pnpm lint | Exit 0 | logs/m04-lint.log; script API/Web/contracts hiện chỉ echo, không phải bằng chứng ESLint thật |
| pnpm test | PASS, exit 0 | logs/m04-unit.log: API 52 suites, 326 tests; Web test là echo. Có cảnh báo worker phải force exit do teardown/timer của suite hiện có |
| pnpm build | PASS, exit 0 | logs/m04-build.log: contracts, Nest API và Next.js Web build thành công |
| pnpm test:m04:postgres (thiếu URL) | Bị guard từ chối đúng thiết kế, exit 1 | logs/m04-db-guard.log; không truy cập DB mặc định |
| pnpm test:m04:postgres (URL test riêng, lần đầu) | BLOCKED, exit 1 | logs/m04-postgres.log: không kết nối 127.0.0.1:5435 trong beforeAll; Jest báo 10 failed, không có assertion nghiệp vụ nào chạy đạt |
| pnpm test:e2e --bail (DATABASE_URL test riêng) | BLOCKED, exit 1 | logs/m04-e2e.log: auth.e2e-spec.ts không kết nối được PostgreSQL khi bootstrap/cleanup; Jest báo 48 failed, 1/10 suite. Các suite còn lại chưa chạy do bail |
| docker ps (lần đầu) | BLOCKED | Không kết nối được Docker Desktop Linux engine tại thời điểm chạy ban đầu |
| docker ps / pg_isready (kiểm tra lại) | PASS | campusjob-official-postgres-1 healthy, host 5435 → container 5432; PostgreSQL accepting connections |
| prisma migrate deploy (DATABASE_URL test riêng) | PASS, exit 0 | Tạo mới campusjob_m04_test do chưa tồn tại; 13 migration sẵn có áp dụng thành công; logs/m04-test-migrate.log |
| pnpm test:m04:postgres (sau khôi phục DB) | PASS, exit 0 | logs/m04-postgres-restored.log: 1 suite, 10/10 test đạt; 9.813 giây. DB01–DB10 đã kiểm chứng trên PostgreSQL thật |
| git diff --check | PASS tại thời điểm kiểm tra | Không có lỗi whitespace |

Logs nằm trong thư mục logs/ bị Git ignore theo quy ước hiện có. Kết quả PostgreSQL pass lấy từ lần chạy DB thật sau khôi phục, không suy ra từ unit hoặc fixture tests. Không chạy migration/reset/truncate trên database dev. File .env local được tạo từ .env.example nếu chưa có; không đưa vào Git.

Lỗi kết nối ban đầu là Docker/PostgreSQL chưa sẵn sàng. Khi kiểm tra lại, Docker đã healthy và .env trỏ đúng localhost:5435/campusjob. Không cần đổi mật khẩu hoặc cổng. Database test campusjob_m04_test chưa có nên đã tạo mới và áp migration với DATABASE_URL trỏ riêng database này. Suite dùng M04_TEST_DATABASE_URL; không sửa DATABASE_URL trong .env dev. Chỉ gỡ blocker hạ tầng; E01–E15 full integration vẫn chưa chạy.

## 1.3. Thay đổi ngoài file test cần thiết

Sửa duy nhất dấu } còn thiếu để kết thúc model SanctionEvent trong schema.prisma. Lỗi này có sẵn ở HEAD trước thay đổi; nó chặn generate/validate và mọi test dùng Prisma. Không thay trường, constraint, migration hoặc business rule của M05.

Cập nhật phần dependency của M04_APPLICATION_INTERVIEW_CONTRACT.md: tài liệu cũ nói không có CV/Company/Notification, trong khi checkout này đã có. Giữ trạng thái tích hợp pending; không tự duyệt contract còn draft.

## 1.4. Để chạy tiếp

1. Database cô lập campusjob_m04_test đã được tạo và migrate; pnpm test:m04:postgres đã đạt 10/10. Những lần chạy sau cần Docker healthy và M04_TEST_DATABASE_URL trỏ đúng database test theo M04_SPRINT3.md.
2. M03 cung cấp C-07 API/adapter thật; M02/M04 chốt namespace ID; Owner/PM chốt state mapping; M04/M05 duyệt event/recipient/idempotency và C-10/C-15/C-20.
3. Bind M04 thật trong ứng dụng và tự động hóa E01–E15 qua HTTP/auth/PostgreSQL thật. Bộ repository regression không thay thế bước này.
