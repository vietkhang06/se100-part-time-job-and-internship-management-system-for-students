# S3-M05-02 — Tổng quan hệ thống (UC54) — DRAFT

> Task: S3-M05-02. UC: UC54 (xem tổng quan hệ thống). Phân quyền: chỉ Quản trị viên (C-02).
> Dữ liệu: từ nguồn thật của module sở hữu, không hardcode, không cache. Không thêm chỉ số ngoài UC54.

## 1. API
`GET /api/v1/admin/overview` (Admin). Trả luôn 5 nhóm theo thứ tự cố định:

```jsonc
{
  "generatedAt": "2026-10-22T03:00:00.000Z",
  "groups": [
    { "key": "USERS", "label": "Người dùng", "status": "AVAILABLE", "total": 12,
      "breakdownLabel": "Theo vai trò",
      "breakdown": [{ "key": "STUDENT", "label": "Sinh viên", "count": 8 }, ...],
      "unavailableReason": null },
    { "key": "JOBS", "label": "Tin tuyển dụng", "status": "UNAVAILABLE", "total": null,
      "breakdownLabel": null, "breakdown": [], "unavailableReason": "Chưa có nguồn dữ liệu từ M03 Job." }
  ]
}
```
- `AVAILABLE`: `total` bằng tổng các `count` trong `breakdown`.
- `UNAVAILABLE`: chưa có nguồn hoặc truy vấn lỗi; `total = null`, **không trả số 0 giả**. Một nhóm lỗi không làm hỏng các nhóm còn lại.
- Mã lỗi: 401 chưa đăng nhập, 403 không phải Admin.

## 2. Nguồn dữ liệu từng nhóm và blocker
| Nhóm | Nguồn | Trạng thái | Blocker / việc cần làm |
|---|---|---|---|
| USERS (theo vai trò) | M01 — bảng `User`, chỉ đếm | **Sẵn sàng** | Xác nhận cách đọc: trực tiếp bảng `User` (hiện tại) hay qua repository của M01 |
| REPORTS (theo trạng thái) | M05 — bảng `ViolationReport` | **Sẵn sàng** | — |
| COMPANIES | M03 Company (S2-M03-02 đã xong theo sheet) | **Chưa nối** | M03 cài `IOverviewSource` cho nhóm này (hoặc Lead cho phép M05 đọc bảng Company). Cần M03 chốt chiều phân tách (đề xuất: theo trạng thái xác minh) |
| JOBS | M03 Job | **Blocker** | S2-M03-03/04 (Job Contract, Lifecycle) đang làm; chưa có bảng/repository để đếm. Đề xuất chiều: theo trạng thái tin |
| APPLICATIONS | M04 Application | **Blocker** | S2-M04-02 đang làm; M04 cài `IOverviewSource`. Đề xuất chiều: theo trạng thái hồ sơ |

Giao diện hiển thị rõ "Chưa có dữ liệu" kèm lý do cho các nhóm chưa có nguồn, không hiển thị số 0.

## 3. Cách module khác nối nguồn
`OverviewSourceRegistry` được export từ `AdminOverviewModule`. Module sở hữu dữ liệu đăng ký trong `onModuleInit`:

```ts
overviewRegistry.register({
  key: OverviewGroupKey.APPLICATIONS,
  async collect() {
    const rows = await applicationRepository.countByStatus();   // repository của M04
    const breakdown = rows.map((r) => ({ key: r.status, label: labelOf(r.status), count: r.count }));
    return { total: breakdown.reduce((s, i) => s + i.count, 0), breakdownLabel: 'Theo trạng thái', breakdown };
  },
});
```
Yêu cầu: số liệu tính từ dữ liệu thật tại thời điểm gọi; `total` bằng tổng `breakdown`. Chỉ cần đăng ký là giao diện tự hiển thị, không phải sửa M05.

## 4. Kiểm thử đối soát (`apps/api/test/admin-overview.e2e-spec.ts`)
Số liệu API được đối chiếu với truy vấn đếm trực tiếp vào bảng nguồn: tổng và từng vai trò (OV-3), tổng và từng trạng thái báo cáo (OV-4);
số liệu đổi theo dữ liệu thật khi thêm/xóa bản ghi (OV-5); phân quyền (OV-1); thứ tự và số nhóm cố định (OV-2);
bất biến "có số thật hoặc UNAVAILABLE kèm lý do" (OV-6); cơ chế đăng ký nguồn cho M03/M04 (OV-7).
Khi M03/M04 nối nguồn thật, thêm test đối soát tương tự cho nhóm của họ (mẫu: OV-3/OV-4).
