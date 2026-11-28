import { NotificationEventType } from '@campusjob/contracts';
import { NotificationEmailPreferencePolicy } from './notification-email-preference.policy';

describe('NotificationEmailPreferencePolicy', () => {
  it('covers all 15 NotificationEventType enum members in email-capability classification', () => {
    const all15Events = Object.values(NotificationEventType);
    expect(all15Events.length).toBe(15);

    const emailCapableEvents = all15Events.filter((e) =>
      NotificationEmailPreferencePolicy.isEmailCapable(e),
    );
    const inAppOnlyEvents = all15Events.filter(
      (e) => !NotificationEmailPreferencePolicy.isEmailCapable(e),
    );

    expect(emailCapableEvents.length).toBe(11);
    expect(inAppOnlyEvents.length).toBe(4);

    // Exact 11 email-capable events
    expect(emailCapableEvents.sort()).toEqual(
      [
        NotificationEventType.JOB_APPROVED,
        NotificationEventType.JOB_REJECTED,
        NotificationEventType.JOB_HIDDEN,
        NotificationEventType.COMPANY_VERIFICATION_RESULT,
        NotificationEventType.APPLICATION_STATUS_CHANGED,
        NotificationEventType.INTERVIEW_INVITED,
        NotificationEventType.INTERVIEW_RESCHEDULE_REQUESTED,
        NotificationEventType.INTERVIEW_RESCHEDULE_RESOLVED,
        NotificationEventType.INTERVIEW_RESULT_RECORDED,
        NotificationEventType.REPORT_RESOLVED,
        NotificationEventType.SANCTION_APPLIED,
      ].sort(),
    );

    // Exact 4 in-app only events
    expect(inAppOnlyEvents.sort()).toEqual(
      [
        NotificationEventType.JOB_SUBMITTED_FOR_REVIEW,
        NotificationEventType.APPLICATION_SUBMITTED,
        NotificationEventType.INTERVIEW_CONFIRMED,
        NotificationEventType.REPORT_RECEIVED,
      ].sort(),
    );
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
