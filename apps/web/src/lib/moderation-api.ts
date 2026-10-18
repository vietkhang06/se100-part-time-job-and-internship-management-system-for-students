import type {
  ModerationDecisionDto,
  ModerationItemDetailDto,
  ModerationItemDto,
  PaginatedResponse,
} from '@campusjob/contracts';
import { apiClient, ApiClientError, refreshSession } from '@/lib/api-client';
import type { ModerationDecisionValue } from '@/lib/moderation-labels';

export interface ListModerationQueueParams {
  status: string;
  targetType?: string;
  assignedToMe?: boolean;
  page: number;
  limit?: number;
}

export interface DecideModerationBody {
  decision: ModerationDecisionValue;
  reason?: string;
  proposedAction?: string;
}

export interface DecideModerationResponse {
  item: ModerationItemDto;
  decision: ModerationDecisionDto;
}

/** Gọi API; nếu access token hết hạn (401) thì làm mới phiên một lần rồi gọi lại. */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  try {
    return await apiClient<T>(endpoint, options);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      await refreshSession();
      return apiClient<T>(endpoint, options);
    }
    throw error;
  }
}

/** UC50 — hàng đợi kiểm duyệt. */
export function listModerationQueue(params: ListModerationQueueParams) {
  const query = new URLSearchParams({
    status: params.status,
    page: String(params.page),
    limit: String(params.limit ?? 10),
  });
  if (params.targetType) query.set('targetType', params.targetType);
  if (params.assignedToMe) query.set('assignedToMe', 'true');
  return request<PaginatedResponse<ModerationItemDto>>(`/moderation/queue?${query.toString()}`);
}

export function getModerationItem(id: string) {
  return request<ModerationItemDetailDto>(`/moderation/items/${encodeURIComponent(id)}`);
}

export function claimModerationItem(id: string) {
  return request<ModerationItemDto>(`/moderation/items/${encodeURIComponent(id)}/claim`, {
    method: 'POST',
  });
}

/** UC51 / UC52 / UC53 — ra quyết định kiểm duyệt. */
export function decideModerationItem(id: string, body: DecideModerationBody) {
  return request<DecideModerationResponse>(`/moderation/items/${encodeURIComponent(id)}/decision`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
