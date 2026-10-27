import type { AdminOverviewDto } from '@campusjob/contracts';
import { request } from '@/lib/m05-request';

/** UC54 — số liệu tổng quan hệ thống (chỉ Quản trị viên). */
export function getAdminOverview() {
  return request<AdminOverviewDto>('/admin/overview');
}
