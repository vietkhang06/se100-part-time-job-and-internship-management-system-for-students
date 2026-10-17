import {
  ModerationDecisionType as D,
  ModerationStatus as S,
  ModerationTargetType as T,
} from '@campusjob/contracts';
import { isDecisionAllowed, isReasonRequired, statusForDecision } from './moderation-state.policy';

describe('moderation-state.policy', () => {
  it('allows approve/reject/hide for JOB only', () => {
    expect(isDecisionAllowed(T.JOB, D.APPROVE)).toBe(true);
    expect(isDecisionAllowed(T.JOB, D.REJECT)).toBe(true);
    expect(isDecisionAllowed(T.JOB, D.HIDE)).toBe(true);
    expect(isDecisionAllowed(T.JOB, D.RESTORE)).toBe(false);
    expect(isDecisionAllowed(T.JOB, D.SUBSTANTIATE)).toBe(false);
  });

  it('allows hide/restore for REVIEW and substantiate/dismiss for REPORT', () => {
    expect(isDecisionAllowed(T.REVIEW, D.HIDE)).toBe(true);
    expect(isDecisionAllowed(T.REVIEW, D.RESTORE)).toBe(true);
    expect(isDecisionAllowed(T.REVIEW, D.APPROVE)).toBe(false);
    expect(isDecisionAllowed(T.REPORT, D.SUBSTANTIATE)).toBe(true);
    expect(isDecisionAllowed(T.REPORT, D.DISMISS)).toBe(true);
    expect(isDecisionAllowed(T.REPORT, D.APPROVE)).toBe(false);
  });

  it('maps every decision to a non-pending status', () => {
    for (const d of Object.values(D)) {
      expect(statusForDecision(d)).not.toBe(S.PENDING);
    }
    expect(statusForDecision(D.APPROVE)).toBe(S.APPROVED);
    expect(statusForDecision(D.RESTORE)).toBe(S.RESTORED);
  });

  it('requires a reason for negative decisions only', () => {
    expect(isReasonRequired(D.REJECT)).toBe(true);
    expect(isReasonRequired(D.HIDE)).toBe(true);
    expect(isReasonRequired(D.DISMISS)).toBe(true);
    expect(isReasonRequired(D.APPROVE)).toBe(false);
    expect(isReasonRequired(D.RESTORE)).toBe(false);
  });
});
