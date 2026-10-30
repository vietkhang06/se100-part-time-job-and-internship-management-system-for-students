import {
  ModerationDecisionType as D,
  ModerationStatus as S,
  ModerationTargetType as T,
  ReviewVisibility,
} from '@campusjob/contracts';
import { ReviewModerationTargetHandler } from './review-moderation-target.handler';
import { IReviewRepository } from '../../domain/repositories/review.repository.interface';

const ctx = (decision: D) => ({
  itemId: 'i1', decisionId: 'd1', targetType: T.REVIEW, targetId: 'rev1', decision,
  newStatus: S.HIDDEN, reason: 'x', proposedAction: null, reviewerId: 'mod1',
});

describe('ReviewModerationTargetHandler', () => {
  let repo: jest.Mocked<IReviewRepository>;
  let handler: ReviewModerationTargetHandler;

  beforeEach(() => {
    repo = {
      create: jest.fn(), findById: jest.fn(), listByStudent: jest.fn(), listVisibleByCompany: jest.fn(),
      summarizeVisibleByCompany: jest.fn(), createReply: jest.fn(), setVisibility: jest.fn().mockResolvedValue(true),
    };
    handler = new ReviewModerationTargetHandler(repo);
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
