import { NotificationEventType } from '@campusjob/contracts';
import { buildNotificationContent } from './notification-content';
import { NOTIFICATION_EVENT_FIXTURES } from './notification-event.fixtures';

const SENSITIVE_KEYS = ['email', 'phone', 'password', 'token', 'cvUrl', 'address', 'storageKey'];

describe('C-20 notification event matrix (S3-M05-05)', () => {
  it('has exactly one fixture per NotificationEventType', () => {
    const fixtureTypes = NOTIFICATION_EVENT_FIXTURES.map((f) => f.eventType).sort();
    const enumTypes = Object.values(NotificationEventType).sort();
    expect(fixtureTypes).toEqual(enumTypes);
    expect(new Set(fixtureTypes).size).toBe(fixtureTypes.length);
  });

  it.each(NOTIFICATION_EVENT_FIXTURES.map((f) => [f.eventType, f] as const))(
    '%s: email flag matches the notification template',
    (_type, fixture) => {
      const content = buildNotificationContent(fixture.eventType, fixture.payload);
      expect(content.sendEmail).toBe(fixture.sendEmail);
      expect(content.title.length).toBeGreaterThan(0);
      expect(content.body.length).toBeGreaterThan(0);
    },
  );

  it.each(NOTIFICATION_EVENT_FIXTURES.map((f) => [f.eventType, f] as const))(
    '%s: sample payload carries every required field and no sensitive field',
    (_type, fixture) => {
      for (const key of fixture.requiredPayload) {
        expect(fixture.payload[key]).toBeDefined();
      }
      for (const key of Object.keys(fixture.payload)) {
        expect(SENSITIVE_KEYS).not.toContain(key);
      }
    },
  );

  it.each(NOTIFICATION_EVENT_FIXTURES.map((f) => [f.eventType, f] as const))(
    '%s: dedupe key starts with the event type and is stable per business object',
    (_type, fixture) => {
      expect(fixture.dedupeKeyTemplate.startsWith(`${fixture.eventType}:`)).toBe(true);
      expect(fixture.dedupeKeyTemplate).toMatch(/<\w+>/);
    },
  );

  it('requires a reason for rejecting or hiding a job', () => {
    for (const type of [NotificationEventType.JOB_REJECTED, NotificationEventType.JOB_HIDDEN]) {
      const f = NOTIFICATION_EVENT_FIXTURES.find((x) => x.eventType === type)!;
      expect(f.requiredPayload).toContain('reason');
    }
  });

  it('keeps fan-out events unique per recipient in the dedupe key', () => {
    const fanOut = NOTIFICATION_EVENT_FIXTURES.filter(
      (f) => f.recipient === 'MODERATOR_GROUP' || f.recipient === 'JOB_MANAGERS',
    );
    expect(fanOut.length).toBeGreaterThan(0);
    for (const f of fanOut) expect(f.dedupeKeyTemplate).toContain('<recipientId>');
  });

  it('marks an event IMPLEMENTED only when its producer module is M04 or M05 and no wiring blocker remains', () => {
    for (const f of NOTIFICATION_EVENT_FIXTURES.filter((x) => x.status === 'IMPLEMENTED')) {
      expect(['M04', 'M05']).toContain(f.producer);
      expect(f.blockers.filter((b) => b.includes('chưa gọi publish'))).toHaveLength(0);
    }
  });

  it('keeps events without a producer as DRAFT and owned by M03 with an open point', () => {
    const drafts = NOTIFICATION_EVENT_FIXTURES.filter((x) => x.status === 'DRAFT');
    expect(drafts.length).toBeGreaterThan(0);
    for (const f of drafts) {
      expect(f.producer).toBe('M03');
      expect(f.blockers.length).toBeGreaterThan(0);
    }
  });
});
