import {
  apiClient,
  setAccessToken,
  getAccessToken,
  ApiClientError,
} from './api-client';

describe('apiClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAccessToken(null);
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('does NOT include Content-Type header on GET requests without body (avoids CORS preflight)', async () => {
    let capturedHeaders: Record<string, string> | undefined;
    let capturedUrl: string | undefined;

    global.fetch = jest.fn().mockImplementation((url, init) => {
      capturedUrl = url;
      capturedHeaders = init?.headers;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ jobs: [], total: 0 }),
      });
    });

    const result = await apiClient<{ jobs: unknown[]; total: number }>('/jobs?page=1&limit=10');

    expect(capturedUrl).toContain('/api/v1/jobs?page=1&limit=10');
    expect(capturedHeaders).toBeDefined();
    expect(capturedHeaders!['Content-Type']).toBeUndefined();
    expect(result.jobs).toEqual([]);
  });

  it('sets Content-Type: application/json when request body is present and not FormData', async () => {
    let capturedHeaders: Record<string, string> | undefined;

    global.fetch = jest.fn().mockImplementation((_url, init) => {
      capturedHeaders = init?.headers;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    await apiClient('/jobs', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Job' }),
    });

    expect(capturedHeaders!['Content-Type']).toBe('application/json');
  });

  it('does NOT overwrite Content-Type when request body is FormData', async () => {
    let capturedHeaders: Record<string, string> | undefined;

    global.fetch = jest.fn().mockImplementation((_url, init) => {
      capturedHeaders = init?.headers;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'file-123' }),
      });
    });

    // In node test environment, construct a mock FormData or object
    class FakeFormData {}
    const fakeFormData = new FakeFormData();
    Object.setPrototypeOf(fakeFormData, FormData.prototype);

    await apiClient('/upload', {
      method: 'POST',
      body: fakeFormData as unknown as FormData,
    });

    expect(capturedHeaders!['Content-Type']).toBeUndefined();
  });

  it('includes Authorization Bearer header only when accessToken is set', async () => {
    let capturedHeaders: Record<string, string> | undefined;

    global.fetch = jest.fn().mockImplementation((_url, init) => {
      capturedHeaders = init?.headers;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    });

    // Without token
    await apiClient('/student/saved-jobs');
    expect(capturedHeaders!['Authorization']).toBeUndefined();

    // With token
    setAccessToken('mock-jwt-token');
    expect(getAccessToken()).toBe('mock-jwt-token');

    await apiClient('/student/saved-jobs');
    expect(capturedHeaders!['Authorization']).toBe('Bearer mock-jwt-token');
  });

  it('allows overriding credentials mode via options', async () => {
    let capturedCredentials: RequestCredentials | undefined;

    global.fetch = jest.fn().mockImplementation((_url, init) => {
      capturedCredentials = init?.credentials;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    await apiClient('/jobs', { credentials: 'same-origin' });
    expect(capturedCredentials).toBe('same-origin');

    await apiClient('/jobs');
    expect(capturedCredentials).toBe('include');
  });

  it('throws ApiClientError with parsed error response on non-2xx response', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ statusCode: 404, message: 'Job not found' }),
      });
    });

    await expect(apiClient('/jobs/non-existent')).rejects.toThrow(ApiClientError);
  });
});
