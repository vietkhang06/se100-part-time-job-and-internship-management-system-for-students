import { ApiErrorResponse, RefreshResponseDto } from '@campusjob/contracts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export class ApiClientError extends Error {
  constructor(
    public readonly errorResponse: ApiErrorResponse,
    public readonly status: number,
  ) {
    super(
      Array.isArray(errorResponse.message)
        ? errorResponse.message.join(', ')
        : errorResponse.message || 'API request failed',
    );
    this.name = 'ApiClientError';
  }
}

let refreshPromise: Promise<RefreshResponseDto> | null = null;

export function refreshSession(): Promise<RefreshResponseDto> {
  if (!refreshPromise) {
    refreshPromise = apiClient<RefreshResponseDto>('/auth/refresh', { method: 'POST' })
      .then((response) => {
        setAccessToken(response.accessToken);
        return response;
      })
      .catch((error) => {
        setAccessToken(null);
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  return request<T>(endpoint, options, false);
}

async function request<T>(endpoint: string, options: RequestInit, retried: boolean): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (inMemoryAccessToken) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // for HttpOnly refresh cookie
  });

  if (!response.ok) {
    // A refreshed session may have outlived the in-memory access token after reload.
    // Refresh once and retry protected requests; never retry the refresh/login call itself.
    if (response.status === 401 && !retried && !endpoint.startsWith('/auth/')) {
      let refreshed = false;
      try {
        await refreshSession();
        refreshed = true;
      } catch {
        // Return the original unauthorized response below.
      }
      if (refreshed) return request<T>(endpoint, options, true);
    }
    let errorData: ApiErrorResponse;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        statusCode: response.status,
        message: response.statusText,
        error: response.statusText,
        timestamp: new Date().toISOString(),
        path: endpoint,
      };
    }
    throw new ApiClientError(errorData, response.status);
  }

  return response.json();
}
