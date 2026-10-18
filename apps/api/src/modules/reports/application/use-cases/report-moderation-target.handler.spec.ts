import {
  ModerationDecisionType as D,
  ModerationStatus as S,
  ModerationTargetType as T,
  ViolationReportStatus,
} from '@campusjob/contracts';
import { ReportModerationTargetHandler } from './report-moderation-target.handler';

const ctx = (decision: D) => ({
  itemId: 'i1', decisionId: 'd1', targetType: T.REPORT, targetId: 'r1', decision,
  newStatus: S.SUBSTANTIATED, reason: 'x', proposedAction: null, reviewerId: 'mod1',
});

describe('ReportModerationTargetHandler', () => {
  let repo: { applyModerationOutcome: jest.Mock };
  let handler: ReportModerationTargetHandler;

  beforeEach(() => {
    repo = { applyModerationOutcome: jest.fn().mockResolvedValue(true) };
    handler = new ReportModerationTargetHandler(repo as any);
  });

  it('marks the report substantiated or dismissed', async () => {
    await handler.applyDecision(ctx(D.SUBSTANTIATE));
    expect(repo.applyModerationOutcome).toHaveBeenCalledWith('r1', ViolationReportStatus.SUBSTANTIATED, expect.any(Date));
    await handler.applyDecision(ctx(D.DISMISS));
    expect(repo.applyModerationOutcome).toHaveBeenCalledWith('r1', ViolationReportStatus.DISMISSED, expect.any(Date));
  });

  it('throws for unsupported decisions and for missing reports', async () => {
    await expect(handler.applyDecision(ctx(D.APPROVE))).rejects.toThrow();
    repo.applyModerationOutcome.mockResolvedValue(false);
    await expect(handler.applyDecision(ctx(D.DISMISS))).rejects.toThrow('not found');
  });
});
