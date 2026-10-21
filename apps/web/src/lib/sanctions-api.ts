import type {
  PaginatedResponse,
  SanctionDetailDto,
  SanctionDto,
  ViolationReportDetailDto,
} from '@campusjob/contracts';
import { buildQuery, request } from '@/lib/m05-request';

export interface ApplySanctionBody {
  reportId: string;
  type: string;
  reason: string;
  durationDays?: number;
}

/** UC59 — báo cáo đã có căn cứ, chờ Quản trị viên phán quyết. */
export function listReportsAwaitingVerdict(page: number, limit = 10) {
  return request<PaginatedResponse<ViolationReportDetailDto>>(`/sanctions/reports${buildQuery({ page, limit })}`);
}

/** UC59/UC60/UC56 — áp chế tài. */
export function applySanction(body: ApplySanctionBody) {
  return request<SanctionDetailDto>('/sanctions', { method: 'POST', body: JSON.stringify(body) });
}

/** UC59 — phán quyết không xử phạt, đóng báo cáo. */
export function closeReportWithoutSanction(reportId: string, reason: string) {
  return request<{ reportId: string }>(`/sanctions/reports/${encodeURIComponent(reportId)}/close`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function listSanctions(params: { status?: string; type?: string; page: number; limit?: number }) {
  return request<PaginatedResponse<SanctionDto>>(
    `/sanctions${buildQuery({ status: params.status, type: params.type, page: params.page, limit: params.limit ?? 10 })}`,
  );
}

export function getSanction(id: string) {
  return request<SanctionDetailDto>(`/sanctions/${encodeURIComponent(id)}`);
}

/** UC57 — gỡ chế tài. */
export function liftSanction(id: string, reason: string) {
  return request<SanctionDetailDto>(`/sanctions/${encodeURIComponent(id)}/lift`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** Sinh viên xem chế tài áp lên tài khoản của mình. */
export function listMySanctions(page: number, limit = 10) {
  return request<PaginatedResponse<SanctionDto>>(`/sanctions/mine${buildQuery({ page, limit })}`);
}
