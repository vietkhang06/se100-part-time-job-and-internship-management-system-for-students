import { SanctionTargetType, SanctionType as S, ViolationTargetType as V } from '@campusjob/contracts';
import {
  MAX_LOCK_DAYS,
  WARNING_ESCALATION_THRESHOLD,
  allowedSanctionTypes,
  computeEndsAt,
  requiresEscalation,
  sanctionTargetType,
  validateDuration,
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

  it('requires a bounded duration for application locks and forbids it elsewhere', () => {
    expect(validateDuration(S.APPLICATION_LOCK, undefined)).not.toBeNull();
    expect(validateDuration(S.APPLICATION_LOCK, 0)).not.toBeNull();
    expect(validateDuration(S.APPLICATION_LOCK, MAX_LOCK_DAYS + 1)).not.toBeNull();
    expect(validateDuration(S.APPLICATION_LOCK, 1.5)).not.toBeNull();
    expect(validateDuration(S.APPLICATION_LOCK, 30)).toBeNull();
    expect(validateDuration(S.WARNING, undefined)).toBeNull();
    expect(validateDuration(S.WARNING, 7)).not.toBeNull();
    expect(validateDuration(S.COMPANY_SUSPENSION, 7)).not.toBeNull();
  });

  it('computes the end of a lock and leaves other sanctions open-ended', () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    expect(computeEndsAt(S.APPLICATION_LOCK, 7, now)).toEqual(new Date('2026-10-22T00:00:00.000Z'));
    expect(computeEndsAt(S.WARNING, undefined, now)).toBeNull();
    expect(computeEndsAt(S.COMPANY_SUSPENSION, undefined, now)).toBeNull();
  });

  it('escalates once the warning threshold is reached', () => {
    expect(requiresEscalation(WARNING_ESCALATION_THRESHOLD - 1)).toBe(false);
    expect(requiresEscalation(WARNING_ESCALATION_THRESHOLD)).toBe(true);
  });
});
