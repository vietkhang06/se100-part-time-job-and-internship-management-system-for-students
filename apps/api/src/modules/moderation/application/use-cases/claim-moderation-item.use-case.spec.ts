import { ConflictException, NotFoundException } from '@nestjs/common';
import { ModerationStatus as S, ModerationTargetType as T, UserRole } from '@campusjob/contracts';
import { ClaimModerationItemUseCase } from './claim-moderation-item.use-case';
import { ModerationItemEntity } from '../../domain/entities/moderation-item.entity';
import { IModerationRepository } from '../../domain/repositories/moderation.repository.interface';

const item = (status = S.PENDING, assigneeId: string | null = null) =>
  new ModerationItemEntity({
    id: 'i1', targetType: T.JOB, targetId: 'j1', round: 1, status, summary: null,
    submitterId: null, assigneeId, assignedAt: null, enqueuedAt: new Date(), decidedAt: null,
  });

describe('ClaimModerationItemUseCase', () => {
  let repo: jest.Mocked<IModerationRepository>;
  let useCase: ClaimModerationItemUseCase;

  beforeEach(() => {
    repo = {
      enqueue: jest.fn(), findById: jest.fn(), list: jest.fn(), claim: jest.fn(), decide: jest.fn(),
      markDecisionSynced: jest.fn(), markDecisionSyncFailed: jest.fn(), findUnsyncedDecisions: jest.fn(),
    };
    useCase = new ClaimModerationItemUseCase(repo);
  });

  it('claims a pending item', async () => {
    repo.findById.mockResolvedValue({ item: item(), decisions: [] });
    repo.claim.mockResolvedValue(item(S.PENDING, 'mod1'));
    const dto = await useCase.execute('i1', { id: 'mod1', role: UserRole.MODERATOR });
    expect(dto.assigneeId).toBe('mod1');
    expect(repo.claim).toHaveBeenCalledWith('i1', 'mod1', expect.any(Date), false);
  });

  it('lets admin force-claim', async () => {
    repo.findById.mockResolvedValue({ item: item(S.PENDING, 'mod2'), decisions: [] });
    repo.claim.mockResolvedValue(item(S.PENDING, 'adm1'));
    await useCase.execute('i1', { id: 'adm1', role: UserRole.ADMIN });
    expect(repo.claim).toHaveBeenCalledWith('i1', 'adm1', expect.any(Date), true);
  });

  it('returns 409 if assigned to someone else', async () => {
    repo.findById.mockResolvedValue({ item: item(S.PENDING, 'mod2'), decisions: [] });
    repo.claim.mockResolvedValue(null);
    await expect(useCase.execute('i1', { id: 'mod1', role: UserRole.MODERATOR })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns 409 if already decided and 404 if missing', async () => {
    repo.findById.mockResolvedValue({ item: item(S.APPROVED), decisions: [] });
    await expect(useCase.execute('i1', { id: 'mod1', role: UserRole.MODERATOR })).rejects.toBeInstanceOf(
      ConflictException,
    );
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('i1', { id: 'mod1', role: UserRole.MODERATOR })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
