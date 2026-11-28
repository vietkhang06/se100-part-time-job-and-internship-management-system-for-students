import { NotificationEventType } from '@campusjob/contracts';
import { setAccessToken } from './api-client';
import {
  getNotificationPreferences,
  updateNotificationPreference,
  getUnreadNotificationCount,
} from './notifications-api';

describe('notifications-api client (R-M05-02 / C-20)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setAccessToken('test-auth-token');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setAccessToken(null);
    jest.restoreAllMocks();
  });

  it('fetches notification email preferences via GET /notifications/preferences', async () => {
    const mockPreferences = [
      { eventType: NotificationEventType.APPLICATION_STATUS_CHANGED, emailEnabled: true },
      { eventType: NotificationEventType.INTERVIEW_INVITED, emailEnabled: false },
    ];

    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockPreferences,
    } as Response);

    globalThis.fetch = fetchMock;

    const result = await getNotificationPreferences();
    expect(result).toEqual(mockPreferences);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/notifications/preferences');
    expect(init.headers['Authorization']).toBe('Bearer test-auth-token');
  });

  it('updates notification email preference via PATCH /notifications/preferences', async () => {
    const updatedPref = {
      eventType: NotificationEventType.APPLICATION_STATUS_CHANGED,
      emailEnabled: false,
    };

    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => updatedPref,
    } as Response);

    globalThis.fetch = fetchMock;

    const result = await updateNotificationPreference(
      NotificationEventType.APPLICATION_STATUS_CHANGED,
      false,
    );

    expect(result).toEqual(updatedPref);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/notifications/preferences');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({
      eventType: NotificationEventType.APPLICATION_STATUS_CHANGED,
      emailEnabled: false,
    });
  });

  it('fetches unread count via GET /notifications/unread-count', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ unreadCount: 5 }),
    } as Response);

    globalThis.fetch = fetchMock;

    const result = await getUnreadNotificationCount();
    expect(result).toEqual({ unreadCount: 5 });
  });
});
