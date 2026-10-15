import { MAX_EMAIL_ATTEMPTS, computeNextRetryAt } from './email-retry.policy';

describe('email-retry.policy', () => {
  const now = new Date('2026-10-13T00:00:00.000Z');

  it('uses increasing backoff after each failure', () => {
    const mins = [1, 2, 3, 4].map(
      (a) => (computeNextRetryAt(a, now)!.getTime() - now.getTime()) / 60000,
    );
    expect(mins).toEqual([1, 5, 15, 60]);
  });

  it('returns null when attempts are exhausted', () => {
    expect(computeNextRetryAt(MAX_EMAIL_ATTEMPTS, now)).toBeNull();
    expect(computeNextRetryAt(MAX_EMAIL_ATTEMPTS + 3, now)).toBeNull();
  });
});
