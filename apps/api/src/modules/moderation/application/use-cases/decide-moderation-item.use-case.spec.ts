import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ModerationDecisionType as D,
  ModerationStatus as S,
  ModerationTargetType as T,
  NotificationEventType,
  UserRole,
} from '@campusjob/contracts';
import { DecideModerationItemUseCase } from './decide-moderation-item.use-case';
import { ModerationTargetHandlerRegistry } from '../ports/moderation-target-handler.port';
import {
  ModerationDecisionEntity,
  ModerationItemEntity,
} from '../../domain/entities/moderation-item.entity';

const item = (over: Partial<ConstructorParameters<typeof ModerationItemEntity>[0]> = {}) =>
  new ModerationItemEntity({
    id: 'i1',
    targetType: T.JOB,
    targetId: 'job1',
    round: 1,
    status: S.PENDING,
    summary: 'Thực tập Backend',
    submitterId: 'emp1',
    assigneeId: null,
    assignedAt: null,
    enqueuedAt: new Date(),
    decidedAt: null,
    ...over,
  });

const decision = (d: D) =>
  new ModerationDecisionEntity({
    id: 'd1',
    itemId: 'i1',
    decision: d,
    reason: null,
    proposedAction: null,
    reviewerId: 'mod1',
    targetSyncedAt: null,
    targetSyncError: null,
    createdAt: new Date(),
  });

describe('DecideModerationItemUseCase', () => {
  const moderator = { id: 'mod1', role: UserRole.MODERATOR };
  let repo: any;
  let handlers: ModerationTargetHandlerRegistry;
  let handler: { applyDecision: jest.Mock };
  let notifications: { publish: jest.Mock };
  let useCase: DecideModerationItemUseCase;

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue({ item: item(), decisions: [] }),
      decide: jest.fn(),
      markDecisionSynced: jest.fn(),
      markDecisionSyncFailed: jest.fn(),
    };
    handlers = new ModerationTargetHandlerRegistry();
    handler = { applyDecision: jest.fn().mockResolvedValue(undefined) };
    handlers.register(T.JOB, handler);
    notifications = { publish: jest.fn().mockResolvedValue({ outcome: 'CREATED' }) };
    useCase = new DecideModerationItemUseCase(repo, handlers, notifications as any);
  });

  const approveSaved = () =>
    repo.decide.mockResolvedValue({ item: item({ status: S.APPROVED }), decision: decision(D.APPROVE) });

  it('approves a job, syncs to target and notifies the employer', async () => {
    approveSaved();
    const result = await useCase.execute('i1', moderator, { decision: D.APPROVE });

    expect(repo.decide).toHaveBeenCalledWith(
      expect.objectContaining({ decision: D.APPROVE, newStatus: S.APPROVED, reviewerId: 'mod1' }),
    );
    expect(handler.applyDecision).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: T.JOB, targetId: 'job1', decision: D.APPROVE }),
    );
    expect(repo.markDecisionSynced).toHaveBeenCalledWith('d1', expect.any(Date));
    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NotificationEventType.JOB_APPROVED,
        recipientId: 'emp1',
        dedupeKey: 'JOB_APPROVED:job1:d1',
      }),
    );
    expect(result.decision.targetSynced).toBe(true);
    expect(result.item.status).toBe(S.APPROVED);
  });

  it('keeps the decision but marks it unsynced when no handler is registered', async () => {
    const empty = new ModerationTargetHandlerRegistry();
    useCase = new DecideModerationItemUseCase(repo, empty, notifications as any);
    approveSaved();

    const result = await useCase.execute('i1', moderator, { decision: D.APPROVE });
    expect(repo.markDecisionSyncFailed).toHaveBeenCalledWith('d1', 'NO_HANDLER_REGISTERED');
    expect(result.decision.targetSynced).toBe(false);
  });

  it('keeps the decision when the target handler throws', async () => {
    approveSaved();
    handler.applyDecision.mockRejectedValue(new Error('M03 down'));

    const result = await useCase.execute('i1', moderator, { decision: D.APPROVE });
    expect(repo.markDecisionSyncFailed).toHaveBeenCalledWith('d1', 'M03 down');
    expect(result.decision.targetSynced).toBe(false);
  });

  it('does not fail the decision when notification publishing throws', async () => {
    approveSaved();
    notifications.publish.mockRejectedValue(new Error('boom'));
    await expect(useCase.execute('i1', moderator, { decision: D.APPROVE })).resolves.toBeDefined();
  });

  it('rejects unknown item with 404', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('x', moderator, { decision: D.APPROVE })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns 409 when item was already decided', async () => {
    repo.findById.mockResolvedValue({ item: item({ status: S.APPROVED }), decisions: [] });
    await expect(useCase.execute('i1', moderator, { decision: D.REJECT, reason: 'x' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.decide).not.toHaveBeenCalled();
  });

  it('returns 409 when another reviewer wins the race', async () => {
    repo.decide.mockResolvedValue(null);
    await expect(useCase.execute('i1', moderator, { decision: D.APPROVE })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects a decision type that does not fit the target type', async () => {
    await expect(useCase.execute('i1', moderator, { decision: D.RESTORE })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires a reason when rejecting', async () => {
    await expect(useCase.execute('i1', moderator, { decision: D.REJECT, reason: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects proposedAction on non-report items', async () => {
    await expect(
      useCase.execute('i1', moderator, { decision: D.APPROVE, proposedAction: 'Khóa tài khoản' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids a moderator from deciding an item assigned to someone else', async () => {
    repo.findById.mockResolvedValue({ item: item({ assigneeId: 'mod2' }), decisions: [] });
    await expect(useCase.execute('i1', moderator, { decision: D.APPROVE })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.decide).not.toHaveBeenCalled();
  });

  it('lets an admin decide an item assigned to someone else', async () => {
    repo.findById.mockResolvedValue({ item: item({ assigneeId: 'mod2' }), decisions: [] });
    approveSaved();
    await expect(
      useCase.execute('i1', { id: 'adm1', role: UserRole.ADMIN }, { decision: D.APPROVE }),
    ).resolves.toBeDefined();
  });

  it('does not notify for REPORT items (triage is preliminary, UC52)', async () => {
    repo.findById.mockResolvedValue({ item: item({ targetType: T.REPORT }), decisions: [] });
    repo.decide.mockResolvedValue({
      item: item({ targetType: T.REPORT, status: S.SUBSTANTIATED }),
      decision: decision(D.SUBSTANTIATE),
    });
    handlers.register(T.REPORT, handler);

    await useCase.execute('i1', moderator, {
      decision: D.SUBSTANTIATE,
      reason: 'Có bằng chứng',
      proposedAction: 'Đề xuất khóa tạm thời',
    });
    expect(notifications.publish).not.toHaveBeenCalled();
  });
});
