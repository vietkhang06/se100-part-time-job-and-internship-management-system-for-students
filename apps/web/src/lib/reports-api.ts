import type {
  PaginatedResponse,
  ViolationReportDetailDto,
  ViolationReportDto,
} from '@campusjob/contracts';
import { buildQuery, request } from '@/lib/m05-request';

export interface CreateReportBody {
  targetType: string;
  targetId: string;
  reason: string;
  description: string;
  evidence?: { url: string; note?: string }[];
}

/** UC49 — gửi báo cáo vi phạm. */
export function createReport(body: CreateReportBody) {
  return request<ViolationReportDto>('/reports', { method: 'POST', body: JSON.stringify(body) });
}

/** UC48 — báo cáo tôi đã gửi. */
export function listMyReports(page: number, limit = 10) {
  return request<PaginatedResponse<ViolationReportDto>>(`/reports/mine${buildQuery({ page, limit })}`);
}

/** UC52 — Kiểm duyệt viên/Quản trị viên xem đầy đủ báo cáo và bằng chứng. */
export function getReportForReview(id: string) {
  return request<ViolationReportDetailDto>(`/reports/review/${encodeURIComponent(id)}`);
}
