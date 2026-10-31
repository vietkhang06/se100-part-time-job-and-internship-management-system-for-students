import { ModerationDecisionType as D, ModerationStatus as S, ModerationTargetType as T } from '@campusjob/contracts';
import { ResyncModerationDecisionsUseCase } from './resync-moderation-decisions.use-case';
import { ModerationTargetHandlerRegistry } from '../ports/moderation-target-handler.port';
import { ModerationDecisionEntity, ModerationItemEntity } from '../../domain/entities/moderation-item.entity';
import { IModerationRepository } from '../../domain/repositories/moderation.repository.interface';

const pair = (type: T) => ({
  item: new ModerationItemEntity({
    id: 'i1', targetType: type, targetId: 't1', round: 1, status: S.APPROVED, summary: null,
    submitterId: null, assigneeId: null, assignedAt: null, enqueuedAt: new Date(), decidedAt: new Date(),
  }),
  decision: new ModerationDecisionEntity({
    id: 'd1', itemId: 'i1', decision: D.APPROVE, reason: null, proposedAction: null, reviewerId: 'm',
    targetSyncedAt: null, targetSyncError: 'NO_HANDLER_REGISTERED', createdAt: new Date(),
  }),
});

describe('ResyncModerationDecisionsUseCase', () => {
  it('applies unsynced decisions once a handler exists', async () => {
    const repo: jest.Mocked<IModerationRepository> = {
      enqueue: jest.fn(), findById: jest.fn(), list: jest.fn(), claim: jest.fn(), decide: jest.fn(),
      findUnsyncedDecisions: jest.fn().mockResolvedValue([pair(T.JOB)]),
      markDecisionSynced: jest.fn(),
      markDecisionSyncFailed: jest.fn(),
    };
    const registry = new ModerationTargetHandlerRegistry();
    const handler = { applyDecision: jest.fn().mockResolvedValue(undefined) };
    registry.register(T.JOB, handler);

    const summary = await new ResyncModerationDecisionsUseCase(repo, registry).execute();
    expect(summary).toEqual({ picked: 1, synced: 1, failed: 0 });
    expect(repo.markDecisionSynced).toHaveBeenCalledWith('d1', expect.any(Date));
  });

  it('keeps failing decisions unsynced when handler is still missing', async () => {
    const repo: jest.Mocked<IModerationRepository> = {
      enqueue: jest.fn(), findById: jest.fn(), list: jest.fn(), claim: jest.fn(), decide: jest.fn(),
      findUnsyncedDecisions: jest.fn().mockResolvedValue([pair(T.JOB)]),
      markDecisionSynced: jest.fn(),
      markDecisionSyncFailed: jest.fn(),
    };
    const summary = await new ResyncModerationDecisionsUseCase(repo, new ModerationTargetHandlerRegistry()).execute();
    expect(summary).toEqual({ picked: 1, synced: 0, failed: 1 });
    expect(repo.markDecisionSynced).not.toHaveBeenCalled();
  });
});
