# C-19 — Sanction Contract (M05)
> Owner: Minh Phương (M05). Task: S2-M05-04. UC (tab Danh sách Use Case): UC59, UC60, UC56 (đình chỉ), UC57 (gỡ).

## 1. Luồng

```
Report SUBSTANTIATED (UC52, C-17)
  → Admin phán quyết (UC59)
       ├─ áp chế tài ──────────→ Sanction ACTIVE + Report RESOLVED + thông báo (người bị chế tài + người báo cáo)
       └─ đóng không xử phạt ──→ Report RESOLVED + thông báo (người báo cáo)
  → Admin gỡ chế tài (UC57) → LIFTED
  → Hết thời hạn → EXPIRED (tự động, tính khi đọc)
```

**Thiếu căn cứ thì không áp chế tài:** chỉ báo cáo `SUBSTANTIATED` mới được phán quyết; `SUBMITTED`, `UNDER_REVIEW`, `DISMISSED` và `RESOLVED` đều bị từ chối (409).

## 2. Quy tắc (đề xuất — DG13)

| Hạng mục | Giá trị hiện tại | Chỉnh tại |
|---|---|---|
| Chế tài theo đối tượng báo cáo | STUDENT: `WARNING`, `APPLICATION_LOCK`; COMPANY: `COMPANY_SUSPENSION`; JOB/REVIEW: không có (chỉ đóng báo cáo) | `sanction-rules.policy.ts` |
| Thời hạn khóa ứng tuyển | 1–90 ngày, bắt buộc với `APPLICATION_LOCK`, cấm với loại khác | `MIN_LOCK_DAYS`, `MAX_LOCK_DAYS` |
| Đình chỉ doanh nghiệp | Không thời hạn, đến khi được gỡ | — |
| Ngưỡng leo thang | Đã có 3 cảnh cáo chưa gỡ trong 180 ngày → cảnh cáo tiếp theo bị từ chối, buộc dùng khóa ứng tuyển | `WARNING_ESCALATION_THRESHOLD`, `WARNING_ESCALATION_WINDOW_DAYS` |
| Một chế tài / báo cáo | `Sanction.reportId` UNIQUE (chống hai Admin cùng bấm) | schema |
| Không chồng chế tài | Đang có khóa/đình chỉ cùng loại → 409 `SANCTION_ALREADY_ACTIVE` | use case |
| Hết hạn | Tính từ `endsAt` khi đọc (`EXPIRED`), không cần job nền | `SanctionEntity.effectiveStatus` |
| Lịch sử | Bảng `SanctionEvent` (APPLIED/LIFTED) + `AuditLog` | repository |

## 3. Cổng để module khác dùng

**M04 — chặn nộp hồ sơ khi đang bị khóa (UC60).** M05 không tự sửa luồng nộp hồ sơ của M04. Gia Khang gọi cổng này trong bước nộp hồ sơ:

```ts
@Inject(SANCTION_QUERY_TOKEN) private readonly sanctions: ISanctionQuery
const { locked, until } = await this.sanctions.getApplicationLock(studentId);
if (locked) throw new ForbiddenException({ code: 'APPLICATION_LOCKED', message: '...' });
```

**M03 — đình chỉ doanh nghiệp (UC56, UC57).** Đăng ký handler (idempotent theo `sanctionId`):

```ts
companySanctionHandlerRegistry.register({
  async describe(companyId) { return { ownerUserId, name } | null; },
  async suspend(companyId, sanctionId, reason) { /* đặt doanh nghiệp ở trạng thái bị đình chỉ */ },
  async unsuspend(companyId, sanctionId) { /* gỡ đình chỉ */ },
});
```
Chưa có handler → áp/gỡ đình chỉ trả 503 `SANCTION_TARGET_UNAVAILABLE` (fail-closed). Nếu handler lỗi → 502 `SANCTION_TARGET_SYNC_FAILED` và **không ghi chế tài**.

## 4. REST API (prefix `/api/v1`)

| Method | Path | Vai trò | Mô tả |
|---|---|---|---|
| GET | `/sanctions/reports?page&limit` | Admin | UC59 — báo cáo có căn cứ chờ phán quyết |
| POST | `/sanctions` | Admin | Áp chế tài: `{ reportId, type, reason, durationDays? }` |
| POST | `/sanctions/reports/:reportId/close` | Admin | Đóng báo cáo không xử phạt: `{ reason }` |
| GET | `/sanctions?status&type&targetId&page&limit` | Admin | Lịch sử chế tài |
| GET | `/sanctions/:id` | Admin | Chi tiết kèm lịch sử |
| POST | `/sanctions/:id/lift` | Admin | UC57 — gỡ chế tài: `{ reason }` |
| GET | `/sanctions/mine?page&limit` | Student | Chế tài áp lên tài khoản của tôi |

Mã lỗi chính: `SANCTION_REPORT_NOT_SUBSTANTIATED`, `SANCTION_REPORT_ALREADY_RESOLVED`, `SANCTION_TYPE_NOT_ALLOWED`, `SANCTION_DURATION_INVALID`, `SANCTION_ESCALATION_REQUIRED`, `SANCTION_ALREADY_ACTIVE`, `SANCTION_ALREADY_APPLIED_FOR_REPORT`, `SANCTION_TARGET_NOT_FOUND`, `SANCTION_TARGET_UNAVAILABLE`, `SANCTION_NOT_ACTIVE`, `SANCTION_REASON_REQUIRED`.

## 5. Thông báo (C-20)

`SANCTION_APPLIED` → người bị chế tài (sinh viên, hoặc chủ doanh nghiệp). `REPORT_RESOLVED` → người báo cáo (cả khi áp chế tài lẫn khi đóng không xử phạt).

## 6. Giao diện (FE)

- `/admin/sanctions`: tab "Chờ phán quyết" (hộp phán quyết) và "Lịch sử chế tài" (lọc, chi tiết, gỡ).
- `/candidate/sanctions`: sinh viên xem chế tài của mình, có cảnh báo khi đang bị khóa ứng tuyển.

## 7. Câu hỏi mở

1. Ngưỡng và thời hạn ở mục 2 có đúng ý nhóm không? (đặc tả DG13 chưa quy định)
2. Một báo cáo chỉ một chế tài (hiện tại). Có cần vừa cảnh cáo vừa khóa không?
3. UC57 "gỡ cờ cảnh báo" có nghĩa là gỡ chế tài (như đang làm) hay một khái niệm riêng cho doanh nghiệp?
4. Có cho sinh viên khiếu nại chế tài không? (chưa có trong đặc tả nên chưa làm)