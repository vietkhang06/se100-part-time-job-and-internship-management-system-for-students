import { MAX_RATING, MIN_RATING, isFinalApplicationStatus, isValidRating } from './review-rules.policy';

describe('review-rules.policy', () => {
  it('accepts ACCEPTED and REJECTED as final application statuses', () => {
    expect(isFinalApplicationStatus('ACCEPTED')).toBe(true);
    expect(isFinalApplicationStatus('REJECTED')).toBe(true);
  });

  it('does not count in-progress or withdrawn applications', () => {
    for (const s of ['SUBMITTED', 'REVIEWING', 'INTERVIEW_SCHEDULED', 'WITHDRAWN']) {
      expect(isFinalApplicationStatus(s)).toBe(false);
    }
  });

  it('validates integer ratings from 1 to 5 only', () => {
    expect(isValidRating(MIN_RATING)).toBe(true);
    expect(isValidRating(MAX_RATING)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(3.5)).toBe(false);
  });
});
