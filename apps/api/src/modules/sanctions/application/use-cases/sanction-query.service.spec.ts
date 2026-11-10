import { SanctionStatus, SanctionTargetType, SanctionType } from '@campusjob/contracts';
import { SanctionQueryService } from './sanction-query.service';
import { SanctionEntity } from '../../domain/entities/sanction.entity';
import { ISanctionRepository } from '../../domain/repositories/sanction.repository.interface';

describe('SanctionQueryService', () => {
  const until = new Date('2026-12-01T00:00:00Z');
  const lock = new SanctionEntity({
    id: 's1', reportId: 'r1', targetType: SanctionTargetType.STUDENT, targetId: 'stu1',
    type: SanctionType.APPLICATION_LOCK, storedStatus: SanctionStatus.ACTIVE, reason: 'x',
    startsAt: new Date(), endsAt: until, imposedBy: 'adm', liftedAt: null, liftReason: null, createdAt: new Date(),
  });

  it('reports a student as locked while an application lock is active', async () => {
    const repo: jest.Mocked<ISanctionRepository> = {
      create: jest.fn(), findById: jest.fn(), list: jest.fn(), listByTarget: jest.fn(),
      findLiftedReportIds: jest.fn(), recordExpired: jest.fn().mockResolvedValue(0),
      findActiveByTarget: jest.fn().mockResolvedValue(lock),
      lift: jest.fn(), recordAudit: jest.fn(),
    };
    const state = await new SanctionQueryService(repo).getApplicationLock('stu1');
    expect(state).toEqual({ locked: true, until });
    expect(repo.findActiveByTarget).toHaveBeenCalledWith(
      SanctionTargetType.STUDENT, 'stu1', SanctionType.APPLICATION_LOCK, expect.any(Date),
    );
  });

  it('reports not locked otherwise', async () => {
    const repo: jest.Mocked<ISanctionRepository> = {
      create: jest.fn(), findById: jest.fn(), list: jest.fn(), listByTarget: jest.fn(),
      findLiftedReportIds: jest.fn(), recordExpired: jest.fn().mockResolvedValue(0),
      findActiveByTarget: jest.fn().mockResolvedValue(null),
      lift: jest.fn(), recordAudit: jest.fn(),
    };
    expect(await new SanctionQueryService(repo).getApplicationLock('stu1')).toEqual({ locked: false, until: null });
  });

  const mockRepo = (over: Partial<jest.Mocked<ISanctionRepository>>): jest.Mocked<ISanctionRepository> => ({
    create: jest.fn(), findById: jest.fn(), list: jest.fn(), listByTarget: jest.fn(),
    findLiftedReportIds: jest.fn(), recordExpired: jest.fn().mockResolvedValue(0),
    findActiveByTarget: jest.fn().mockResolvedValue(null),
    lift: jest.fn(), recordAudit: jest.fn(),
    ...over,
  });

  it('records expiry for the student before checking the lock (SP-19)', async () => {
    const repo = mockRepo({ recordExpired: jest.fn().mockResolvedValue(1) });
    const now = new Date('2026-12-02T00:00:00Z');
    expect(await new SanctionQueryService(repo).getApplicationLock('stu1', now)).toEqual({ locked: false, until: null });
    expect(repo.recordExpired).toHaveBeenCalledWith(now, 'stu1');
  });

  it('still answers when recording expiry fails', async () => {
    const repo = mockRepo({
      recordExpired: jest.fn().mockRejectedValue(new Error('db')),
      findActiveByTarget: jest.fn().mockResolvedValue(lock),
    });
    expect(await new SanctionQueryService(repo).getApplicationLock('stu1')).toEqual({ locked: true, until });
  });
});
