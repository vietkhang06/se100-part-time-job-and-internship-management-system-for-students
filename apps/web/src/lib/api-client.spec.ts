import { apiClient, setAccessToken } from './api-client';

describe('apiClient refresh after access token expires', () => {
  afterEach(() => {
    setAccessToken(null);
    jest.restoreAllMocks();
  });

  it('refreshes once and retries the protected request with the new bearer token', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 401 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'new-token', user: {} }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: ['branch'] }) } as Response);

    expect(await apiClient('/companies/branches')).toEqual({ data: ['branch'] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh');
    expect((fetchMock.mock.calls[2][1]?.headers as Record<string, string>).Authorization).toBe('Bearer new-token');
  });

  it('does not retry unauthorized authentication requests', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }),
    } as Response);

    await expect(apiClient('/auth/login', { method: 'POST' })).rejects.toThrow('Unauthorized');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
