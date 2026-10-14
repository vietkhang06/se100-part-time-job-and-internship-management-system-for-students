import { NotificationEventType } from '@campusjob/contracts';
import { buildNotificationContent } from './notification-content';

describe('buildNotificationContent', () => {
  it('builds content for every event type without throwing on empty payload', () => {
    for (const type of Object.values(NotificationEventType)) {
      const c = buildNotificationContent(type, {});
      expect(c.title).toBeTruthy();
      expect(c.body).toBeTruthy();
      expect(typeof c.sendEmail).toBe('boolean');
    }
  });

  it('includes reason when job is rejected', () => {
    const c = buildNotificationContent(NotificationEventType.JOB_REJECTED, {
      jobTitle: 'Thực tập Backend',
      reason: 'Thiếu mô tả',
    });
    expect(c.body).toContain('Thực tập Backend');
    expect(c.body).toContain('Thiếu mô tả');
    expect(c.sendEmail).toBe(true);
  });

  it('does not email employer for a plain new-application event', () => {
    expect(buildNotificationContent(NotificationEventType.APPLICATION_SUBMITTED, {}).sendEmail).toBe(false);
  });
});
