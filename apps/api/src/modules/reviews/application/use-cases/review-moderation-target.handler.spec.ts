import {
  ModerationDecisionType as D,
  ModerationStatus as S,
  ModerationTargetType as T,
  ReviewVisibility,
} from '@campusjob/contracts';
import { ReviewModerationTargetHandler } from './review-moderation-target.handler';

const ctx = (decision: D) => ({
  itemId: 'i1', decisionId: 'd1', targetType: T.REVIEW, targetId: 'rev1', decision,
  newStatus: S.HIDDEN, reason: 'x', proposedAction: null, reviewerId: 'mod1',
});

describe('ReviewModerationTargetHandler', () => {
  let repo: { setVisibility: jest.Mock };
  let handler: ReviewModerationTargetHandler;

  beforeEach(() => {
    repo = { setVisibility: jest.fn().mockResolvedValue(true) };
    handler = new ReviewModerationTargetHandler(repo as any);
  });

  it('hides on HIDE and restores on RESTORE', async () => {
    await handler.applyDecision(ctx(D.HIDE));
    expect(repo.setVisibility).toHaveBeenCalledWith('rev1', ReviewVisibility.HIDDEN);
    await handler.applyDecision(ctx(D.RESTORE));
    expect(repo.setVisibility).toHaveBeenCalledWith('rev1', ReviewVisibility.VISIBLE);
  });

  it('throws on unsupported decisions or when the review is missing', async () => {
    await expect(handler.applyDecision(ctx(D.APPROVE))).rejects.toThrow('Unsupported');
    repo.setVisibility.mockResolvedValue(false);
    await expect(handler.applyDecision(ctx(D.HIDE))).rejects.toThrow('not found');
  });
});
