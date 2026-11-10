# S3-M05-04 — Chính sách trạng thái kiểm duyệt, phán quyết và chế tài (DRAFT chờ duyệt)

> Task: S3-M05-04. Contract: C-16, C-17, C-19, C-02. Reviewer (cột K sheet): Gia Khang.
> Sản phẩm bàn giao: chính sách chế tài + ma trận chuyển trạng thái + test case. S4-M05-01 đã được code theo bản đề xuất này (spec: SP-01…SP-20 trong `sanction-rules.policy.spec.ts`, `apply-sanction.use-case.spec.ts`, e2e TM-D1…D3); nếu Owner/PM đổi quyết định ở mục 8 thì chỉ sửa `sanction-rules.policy.ts`.
> Ký hiệu: **[SHEET]** = lấy nguyên từ mô tả task trong sheet; **[ĐỀ XUẤT]** = nhóm tự chọn vì sheet chưa nói, cần duyệt.

## 1. Vai trò: ai làm gì

| Hành động | Moderator | Admin | Nguồn |
|---|---|---|---|
| Nhận xử lý mục kiểm duyệt (claim) | Có, chỉ mục được giao | Không bắt buộc | C-16, UC50 |
| Kết luận sơ bộ báo cáo: `SUBSTANTIATE` / `DISMISS` (kèm lý do) | **Có** | Không | UC52 |
| Phán quyết cuối: áp chế tài / đóng không xử phạt | **Không** | **Có** | UC59, [SHEET] |
| Áp `WARNING`, `APPLICATION_LOCK` | Không | Có | UC59, UC60 |
| Đình chỉ doanh nghiệp (`COMPANY_SUSPENSION`) | **Không** (Moderator không tự đình chỉ) | Có | [SHEET] |
| Gỡ chế tài | Không | Có | UC57 |

Moderator chỉ **thẩm tra/đề xuất**; Admin ra **quyết định cuối**. Mọi API áp/gỡ chế tài kiểm tra role `ADMIN` ở tầng controller và ở use case.

## 2. Định nghĩa "lần vi phạm"

[SHEET] "Lần vi phạm là báo cáo đã kết luận/có sanction."

[ĐỀ XUẤT] Với sinh viên bị báo cáo, số lần vi phạm **N** tại thời điểm Admin phán quyết là số báo cáo thỏa **đồng thời**:
1. `targetType = STUDENT`, `targetId` = sinh viên đó;
2. đã được Moderator kết luận **`SUBSTANTIATED`** (báo cáo `DISMISSED` không tính);
3. thời điểm kết luận (`moderatedAt`) nằm trong **cửa sổ 180 ngày** tính ngược từ `now`, **tính cả đầu mút** (đúng 180 ngày trước vẫn tính, 180 ngày + 1 ms thì không);
4. nếu báo cáo đó đã có chế tài và chế tài ở trạng thái `LIFTED` thì **không tính** (Admin đã xác nhận xử lý không còn hiệu lực).

Báo cáo đang xử lý (chính báo cáo Admin đang phán quyết) **được tính vào N**. Đóng báo cáo không xử phạt (sau khi đã `SUBSTANTIATED`) vẫn tính là một lần vi phạm.

"6 tháng" trong đề cương được cố định là **180 ngày** (không dùng tháng lịch để test xác định).

## 3. Bậc chế tài theo N (sinh viên)

| N (trong 180 ngày) | Chế tài **tối thiểu** bắt buộc | Chế tài Admin được chọn | Ghi chú |
|---|---|---|---|
| 1 | Không | Chỉ **đóng báo cáo không xử phạt** (ghi nhận) | Không cho `WARNING`/`APPLICATION_LOCK` ở lần 1 |
| 2 | `WARNING` | `WARNING` hoặc đóng không xử phạt | Cảnh cáo **từ lần 2** [SHEET] |
| ≥ 3 | `APPLICATION_LOCK` | `APPLICATION_LOCK` 30–90 ngày hoặc đóng không xử phạt | Khóa **từ lần 3** [SHEET]; không dùng `WARNING` nữa |

- "Chế tài tối thiểu bắt buộc" nghĩa là: nếu Admin chọn áp chế tài thì không được chọn bậc thấp hơn bậc N cho phép. Admin luôn có thể đóng không xử phạt kèm lý do (ngoại lệ có chủ đích, được ghi audit).
- [ĐỀ XUẤT] Không bắt buộc Admin phải áp chế tài (quyền xét cuối là của Admin); hệ thống chỉ **chặn** áp sai bậc.

### 3.1 Thời hạn khóa ứng tuyển
- [SHEET] 30–90 ngày, số nguyên, bắt buộc với `APPLICATION_LOCK`, cấm với loại khác.
- **Vấn đề dữ liệu:** sheet ghi "theo severity đã chốt", nhưng `ViolationReport` **không có trường severity** (schema hiện tại: `reason`, `description`, `status`...). Hai lựa chọn:
  - **(A) [ĐỀ XUẤT, không đổi schema]** Admin tự nhập `durationDays` ∈ [30, 90]; giao diện gợi ý mặc định theo N: N=3 → 30, N=4 → 60, N≥5 → 90 (chỉ là gợi ý, server chỉ kiểm khoảng 30–90).
  - **(B)** Thêm `severity` vào báo cáo/kết luận của Moderator rồi map severity → số ngày. Cần migration và sửa FE báo cáo → chỉ làm nếu Owner yêu cầu.

### 3.2 Doanh nghiệp
- `COMPANY_SUSPENSION` chỉ do **Admin** áp, **không có ngưỡng đếm** [ĐỀ XUẤT], không thời hạn, kéo dài đến khi Admin gỡ.
- Thực thi qua handler M03 (`ICompanySanctionHandler`); chưa có handler → 503 `SANCTION_TARGET_UNAVAILABLE`; handler lỗi → 502 `SANCTION_TARGET_SYNC_FAILED` và **không ghi chế tài** (giữ nguyên C-19).
- `JOB`/`REVIEW`: không có chế tài trực tiếp; xử lý qua kiểm duyệt (UC51/UC53), Admin vẫn đóng được báo cáo.

## 4. Ma trận chuyển trạng thái

### 4.1 Báo cáo (`ViolationReportStatus`)
| Từ | Sự kiện | Actor | Đến | Điều kiện / lỗi |
|---|---|---|---|---|
| (mới) | Gửi báo cáo | Student/Employer | `SUBMITTED` | Trùng `openKey` → từ chối |
| `SUBMITTED` | Moderator nhận xử lý | Moderator | `UNDER_REVIEW` | Chỉ mục được giao |
| `UNDER_REVIEW` | Kết luận có căn cứ | Moderator | `SUBSTANTIATED` | Lý do bắt buộc; ghi 1 lần |
| `UNDER_REVIEW` | Kết luận không căn cứ | Moderator | `DISMISSED` | Lý do bắt buộc; kết thúc, có thể báo cáo lại |
| `SUBSTANTIATED` | Áp chế tài | **Admin** | `RESOLVED` | Đúng bậc theo N; ghi `Sanction` + `SanctionEvent` + `AuditLog` |
| `SUBSTANTIATED` | Đóng không xử phạt | **Admin** | `RESOLVED` | Lý do bắt buộc |
| `SUBMITTED`/`UNDER_REVIEW`/`DISMISSED`/`RESOLVED` | Áp chế tài hoặc đóng | bất kỳ | giữ nguyên | 409 `SANCTION_REPORT_NOT_SUBSTANTIATED` hoặc `SANCTION_REPORT_ALREADY_RESOLVED` |

### 4.2 Chế tài (`Sanction`)
| Từ | Sự kiện | Actor | Đến | Ghi |
|---|---|---|---|---|
| (mới) | Áp | Admin | `ACTIVE` | `SanctionEvent(APPLIED)` + `AuditLog` |
| `ACTIVE` | Gỡ | Admin | `LIFTED` | `SanctionEvent(LIFTED)` + `AuditLog`, lý do bắt buộc |
| `ACTIVE` | Đến `endsAt` | Hệ thống | `EXPIRED` | **[ĐỀ XUẤT]** ghi `SanctionEvent(EXPIRED)` + `AuditLog` (hiện chỉ tính khi đọc, không ghi) |
| `LIFTED`/`EXPIRED` | bất kỳ | — | giữ nguyên | 409 `SANCTION_NOT_ACTIVE` |

Quy ước biên: `endsAt <= now` ⇒ đã `EXPIRED` (đúng với `effectiveStatus` hiện tại).

### 4.3 Quyết định kiểm duyệt (C-16) — giữ nguyên state rule hiện có
`REPORT`: `SUBSTANTIATE`/`DISMISS`. `JOB`: `APPROVE`/`REJECT`/`HIDE`. `REVIEW`: `HIDE`/`RESTORE`. "Duyệt lại" tạo vòng mới, không sửa vòng cũ.

## 5. Quyền ứng tuyển (UC60)
Khóa ứng tuyển được thực thi **bằng cổng `ISanctionQuery.getApplicationLock`** mà M04 gọi ở bước nộp hồ sơ, **không** đổi `UserStatus` của M01 (tài khoản vẫn `ACTIVE`, chỉ mất quyền nộp hồ sơ). Hiện M04 **chưa gọi** cổng này (đã kiểm tra source); đây là việc cần Gia Khang (M04) làm, ghi là blocker của tiêu chí "quyền ứng tuyển phản ánh thời hạn" ở S4-M05-01.

## 6. Test case (S4-M05-01 phải hiện thực hóa)

| ID | Kịch bản | Kết quả mong đợi |
|---|---|---|
| SP-01 | N=1, áp `WARNING` hoặc `APPLICATION_LOCK` | 409 `SANCTION_TIER_INVALID`, không ghi gì |
| SP-02 | N=1, đóng không xử phạt | OK, báo cáo `RESOLVED`, vẫn tính 1 lần vi phạm |
| SP-03 | N=2, áp `WARNING` | OK |
| SP-04 | N=2, áp `APPLICATION_LOCK` | 409 `SANCTION_TIER_INVALID` |
| SP-05 | N=3, áp `WARNING` | 409 `SANCTION_ESCALATION_REQUIRED` |
| SP-06 | N=3, khóa 30 ngày | OK, `endsAt = now + 30d` |
| SP-07 | N=3, khóa 29 / 91 ngày / 45.5 / thiếu | 400 `SANCTION_DURATION_INVALID`, không ghi gì |
| SP-08 | N=3, khóa 30 và 90 ngày | Cả hai OK (biên trong) |
| SP-09 | Vi phạm cũ cách **đúng 180 ngày** | Được tính |
| SP-10 | Vi phạm cũ cách 180 ngày + 1 ms | Không tính → N giảm |
| SP-11 | Vi phạm cũ cách 179 ngày | Được tính |
| SP-12 | Báo cáo `DISMISSED` trong cửa sổ | Không tính |
| SP-13 | Báo cáo của **sinh viên khác** | Không tính |
| SP-14 | Chế tài cũ đã `LIFTED` | Báo cáo đó không tính |
| SP-15 | Báo cáo chưa `SUBSTANTIATED` | 409 `SANCTION_REPORT_NOT_SUBSTANTIATED`, không ghi chế tài |
| SP-16 | Moderator/Employer/Student gọi áp hoặc gỡ | 403 |
| SP-17 | Hai Admin áp cùng một báo cáo | Một thành công, một 409 `SANCTION_ALREADY_APPLIED_FOR_REPORT`; `reportId` duy nhất |
| SP-18 | Đang bị khóa, áp khóa tiếp | 409 `SANCTION_ALREADY_ACTIVE` |
| SP-19 | Khóa hết hạn (`endsAt <= now`) | `getApplicationLock` → `locked=false`; có `SanctionEvent(EXPIRED)` |
| SP-20 | Gỡ khóa | `LIFTED`, `getApplicationLock` → `locked=false`, có event + audit |
| SP-21 | Moderator đình chỉ doanh nghiệp | 403 |
| SP-22 | Admin đình chỉ doanh nghiệp, chưa có handler M03 | 503, không ghi chế tài |
| SP-23 | Mỗi thay đổi (áp/gỡ/hết hạn) | Có `SanctionEvent` **và** `AuditLog` đủ actor/action/object/time |

## 7. Ảnh hưởng tới thứ đang có (S4-M05-01 đã sửa)
| Vị trí | Hiện tại | Phải đổi |
|---|---|---|
| `sanction-rules.policy.ts` | `WARNING_ESCALATION_THRESHOLD = 3`, `MIN_LOCK_DAYS = 1` | Đếm theo N; `MIN_LOCK_DAYS = 30` |
| `countRecentWarnings` | Đếm cảnh cáo `ACTIVE` | Đếm báo cáo `SUBSTANTIATED` trong cửa sổ (mục 2) |
| `SANCTION_API_CONTRACT.md` §2 | Ngưỡng 3 cảnh cáo, 1–90 ngày | Cập nhật theo tài liệu này |
| `m05-trust-integration.e2e-spec.ts` TM-D1, TM-D2 | "3 cảnh cáo thì buộc khóa", "1–90 ngày" | Viết lại theo SP-05/SP-07 |
| `apply-sanction.use-case.spec.ts` | Test ngưỡng 3 cảnh cáo | Viết lại |
| FE `verdict-dialog.tsx` | Chọn loại tự do | Hiện N và loại hợp lệ |

## 8. Điểm cần Owner/PM duyệt trước khi S4 code
1. Lần 1 chỉ "ghi nhận" (không cảnh cáo) — đồng ý?
2. Đóng không xử phạt sau khi `SUBSTANTIATED` vẫn tính là một lần vi phạm — đồng ý?
3. Chế tài đã `LIFTED` thì không tính vào N — đồng ý?
4. Thời hạn khóa: chọn **(A)** Admin nhập 30–90 hay **(B)** thêm severity?
5. Có ghi `SanctionEvent(EXPIRED)` bằng job nền / lazy-on-read (UC61/UC68 chưa có chủ) hay chấp nhận chỉ tính khi đọc và ghi event khi lần đầu đọc thấy hết hạn?
6. Đổi `UserStatus` hay chỉ chặn ở M04 (đề xuất: chỉ chặn ở M04)?
7. Mapping UC56/UC57 cho doanh nghiệp có thuộc phạm vi M05 hay M03 (sheet ghi "cần xác nhận Owner").
