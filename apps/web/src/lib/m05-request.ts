import { apiClient, ApiClientError, refreshSession } from '@/lib/api-client';

/** Gọi API; nếu access token hết hạn (401) thì làm mới phiên một lần rồi gọi lại. */
export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

type QueryValue = string | number | boolean | undefined | null;

export function buildQuery(params: Record<string, QueryValue>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}
