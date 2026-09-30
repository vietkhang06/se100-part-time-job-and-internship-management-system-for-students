import { ApiErrorResponse } from '@campusjob/contracts';

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

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
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
