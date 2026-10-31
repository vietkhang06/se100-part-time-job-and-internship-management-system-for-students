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
      countRecentWarnings: jest.fn(), findActiveByTarget: jest.fn().mockResolvedValue(lock),
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
      countRecentWarnings: jest.fn(), findActiveByTarget: jest.fn().mockResolvedValue(null),
      lift: jest.fn(), recordAudit: jest.fn(),
    };
    expect(await new SanctionQueryService(repo).getApplicationLock('stu1')).toEqual({ locked: false, until: null });
  });
});
