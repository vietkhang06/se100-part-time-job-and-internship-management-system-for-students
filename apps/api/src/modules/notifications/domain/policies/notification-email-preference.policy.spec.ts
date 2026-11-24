import { NotificationEventType } from '@campusjob/contracts';
import { NotificationEmailPreferencePolicy } from './notification-email-preference.policy';

describe('NotificationEmailPreferencePolicy', () => {
  it('identifies email-capable event types correctly', () => {
    expect(
      NotificationEmailPreferencePolicy.isEmailCapable(NotificationEventType.JOB_APPROVED),
    ).toBe(true);
    expect(
      NotificationEmailPreferencePolicy.isEmailCapable(NotificationEventType.APPLICATION_STATUS_CHANGED),
    ).toBe(true);
    expect(
      NotificationEmailPreferencePolicy.isEmailCapable(NotificationEventType.SANCTION_APPLIED),
    ).toBe(true);
    expect(
      NotificationEmailPreferencePolicy.isEmailCapable(NotificationEventType.REPORT_RESOLVED),
    ).toBe(true);

    // Non-email event types
    expect(
      NotificationEmailPreferencePolicy.isEmailCapable(NotificationEventType.JOB_SUBMITTED_FOR_REVIEW),
    ).toBe(false);
    expect(
      NotificationEmailPreferencePolicy.isEmailCapable(NotificationEventType.APPLICATION_SUBMITTED),
    ).toBe(false);
    expect(
      NotificationEmailPreferencePolicy.isEmailCapable(NotificationEventType.INTERVIEW_CONFIRMED),
    ).toBe(false);
    expect(
      NotificationEmailPreferencePolicy.isEmailCapable(NotificationEventType.REPORT_RECEIVED),
    ).toBe(false);
  });

  it('allows disabling email for all email-capable types', () => {
    for (const eventType of NotificationEmailPreferencePolicy.EMAIL_CAPABLE_EVENT_TYPES) {
      expect(NotificationEmailPreferencePolicy.canDisableEmail(eventType)).toBe(true);
    }
  });

  it('resolves email delivery with defaults and explicit overrides', () => {
    // In-app only event always returns false
    expect(
      NotificationEmailPreferencePolicy.resolveEmailDelivery(
        NotificationEventType.APPLICATION_SUBMITTED,
        true,
      ),
    ).toBe(false);

    // Email-capable with no stored preference -> default true
    expect(
      NotificationEmailPreferencePolicy.resolveEmailDelivery(
        NotificationEventType.JOB_APPROVED,
        null,
      ),
    ).toBe(true);
    expect(
      NotificationEmailPreferencePolicy.resolveEmailDelivery(
        NotificationEventType.JOB_APPROVED,
        undefined,
      ),
    ).toBe(true);

    // Email-capable with explicit false -> false (suppressed)
    expect(
      NotificationEmailPreferencePolicy.resolveEmailDelivery(
        NotificationEventType.JOB_APPROVED,
        false,
      ),
    ).toBe(false);

    // Email-capable with explicit true -> true
    expect(
      NotificationEmailPreferencePolicy.resolveEmailDelivery(
        NotificationEventType.JOB_APPROVED,
        true,
      ),
    ).toBe(true);
  });
});
