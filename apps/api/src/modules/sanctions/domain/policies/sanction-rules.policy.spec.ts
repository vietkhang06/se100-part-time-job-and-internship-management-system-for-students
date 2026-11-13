import { SanctionTargetType, SanctionType as S, ViolationTargetType as V } from '@campusjob/contracts';
import {
  LOCK_MIN_VIOLATION,
  MAX_LOCK_DAYS,
  MIN_LOCK_DAYS,
  VIOLATION_WINDOW_DAYS,
  WARNING_MIN_VIOLATION,
  allowedSanctionTypes,
  checkSanctionTier,
  computeEndsAt,
  sanctionTargetType,
  validateDuration,
  violationWindowStart,
} from './sanction-rules.policy';

describe('sanction-rules.policy', () => {
  it('maps report targets to the sanctions that may be applied', () => {
    expect(allowedSanctionTypes(V.STUDENT)).toEqual([S.WARNING, S.APPLICATION_LOCK]);
    expect(allowedSanctionTypes(V.COMPANY)).toEqual([S.COMPANY_SUSPENSION]);
    expect(allowedSanctionTypes(V.JOB)).toEqual([]);
    expect(allowedSanctionTypes(V.REVIEW)).toEqual([]);
  });

  it('knows which kind of target a sanction hits', () => {
    expect(sanctionTargetType(S.WARNING)).toBe(SanctionTargetType.STUDENT);
    expect(sanctionTargetType(S.APPLICATION_LOCK)).toBe(SanctionTargetType.STUDENT);
    expect(sanctionTargetType(S.COMPANY_SUSPENSION)).toBe(SanctionTargetType.COMPANY);
  });

  it('uses the approved thresholds (SP policy: 180 days, warning from 2nd, lock from 3rd, 30–90 days)', () => {
    expect(VIOLATION_WINDOW_DAYS).toBe(180);
    expect(WARNING_MIN_VIOLATION).toBe(2);
    expect(LOCK_MIN_VIOLATION).toBe(3);
    expect(MIN_LOCK_DAYS).toBe(30);
    expect(MAX_LOCK_DAYS).toBe(90);
  });

  describe('lock duration (SP-07, SP-08)', () => {
    it('accepts the inclusive bounds 30 and 90', () => {
      expect(validateDuration(S.APPLICATION_LOCK, 30)).toBeNull();
      expect(validateDuration(S.APPLICATION_LOCK, 90)).toBeNull();
      expect(validateDuration(S.APPLICATION_LOCK, 60)).toBeNull();
    });

    it('rejects 29, 91, fractions and missing values', () => {
      expect(validateDuration(S.APPLICATION_LOCK, 29)).not.toBeNull();
      expect(validateDuration(S.APPLICATION_LOCK, 91)).not.toBeNull();
      expect(validateDuration(S.APPLICATION_LOCK, 45.5)).not.toBeNull();
      expect(validateDuration(S.APPLICATION_LOCK, 0)).not.toBeNull();
      expect(validateDuration(S.APPLICATION_LOCK, undefined)).not.toBeNull();
    });

    it('forbids a duration on sanctions that have none', () => {
      expect(validateDuration(S.WARNING, undefined)).toBeNull();
      expect(validateDuration(S.WARNING, 7)).not.toBeNull();
      expect(validateDuration(S.COMPANY_SUSPENSION, 7)).not.toBeNull();
    });
  });

  it('computes the end of a lock and leaves other sanctions open-ended', () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    expect(computeEndsAt(S.APPLICATION_LOCK, 30, now)).toEqual(new Date('2026-11-14T00:00:00.000Z'));
    expect(computeEndsAt(S.WARNING, undefined, now)).toBeNull();
    expect(computeEndsAt(S.COMPANY_SUSPENSION, undefined, now)).toBeNull();
  });

  describe('violation window (SP-09, SP-10, SP-11)', () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    const start = violationWindowStart(now);

    it('starts exactly 180 days before now', () => {
      expect(start).toEqual(new Date('2026-04-18T00:00:00.000Z'));
    });

    it('counts a violation at exactly 180 days and 179 days, not 180 days + 1 ms', () => {
      const atEdge = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const inside = new Date(now.getTime() - 179 * 24 * 60 * 60 * 1000);
      const outside = new Date(atEdge.getTime() - 1);
      expect(atEdge.getTime() >= start.getTime()).toBe(true);
      expect(inside.getTime() >= start.getTime()).toBe(true);
      expect(outside.getTime() >= start.getTime()).toBe(false);
    });
  });

  describe('sanction tier by violation count (SP-01 … SP-06)', () => {
    it('1st violation: no sanction may be applied, only recorded', () => {
      expect(checkSanctionTier(V.STUDENT, S.WARNING, 1)?.code).toBe('SANCTION_TIER_INVALID');
      expect(checkSanctionTier(V.STUDENT, S.APPLICATION_LOCK, 1)?.code).toBe('SANCTION_TIER_INVALID');
      expect(checkSanctionTier(V.STUDENT, S.WARNING, 0)?.code).toBe('SANCTION_TIER_INVALID');
    });

    it('2nd violation: warning only', () => {
      expect(checkSanctionTier(V.STUDENT, S.WARNING, 2)).toBeNull();
      expect(checkSanctionTier(V.STUDENT, S.APPLICATION_LOCK, 2)?.code).toBe('SANCTION_TIER_INVALID');
    });

    it('3rd violation and later: lock only, warning forces escalation', () => {
      for (const n of [3, 4, 10]) {
        expect(checkSanctionTier(V.STUDENT, S.APPLICATION_LOCK, n)).toBeNull();
        expect(checkSanctionTier(V.STUDENT, S.WARNING, n)?.code).toBe('SANCTION_ESCALATION_REQUIRED');
      }
    });

    it('does not apply a count threshold to company suspension', () => {
      expect(checkSanctionTier(V.COMPANY, S.COMPANY_SUSPENSION, 1)).toBeNull();
      expect(checkSanctionTier(V.COMPANY, S.COMPANY_SUSPENSION, 5)).toBeNull();
    });
  });
});
