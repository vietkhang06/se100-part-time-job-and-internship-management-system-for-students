import { ViolationReportStatus, ViolationTargetType } from '@campusjob/contracts';
import { ReportAdminService } from './report-admin.service';
import { IViolationReportRepository } from '../../domain/repositories/violation-report.repository.interface';

describe('ReportAdminService', () => {
  it('delegates to the repository', async () => {
    const repo: jest.Mocked<IViolationReportRepository> = {
      create: jest.fn(), findById: jest.fn().mockResolvedValue(null), listByReporter: jest.fn(),
      listByStatus: jest.fn().mockResolvedValue({ items: [], total: 0 }), markUnderReview: jest.fn(),
      markResolved: jest.fn().mockResolvedValue(true), applyModerationOutcome: jest.fn(),
      listViolationReportIds: jest.fn().mockResolvedValue(['r1', 'r2']),
    };
    const service = new ReportAdminService(repo);

    expect(await service.findById('r1')).toBeNull();
    expect(await service.listByStatus(ViolationReportStatus.SUBSTANTIATED, 1, 10)).toEqual({ items: [], total: 0 });
    expect(repo.listByStatus).toHaveBeenCalledWith(ViolationReportStatus.SUBSTANTIATED, 1, 10);
    expect(await service.markResolved('r1', new Date())).toBe(true);
    expect(repo.markResolved).toHaveBeenCalledWith('r1', expect.any(Date));

    const since = new Date('2026-04-18T00:00:00.000Z');
    expect(await service.listViolationReportIds(ViolationTargetType.STUDENT, 'stu1', since)).toEqual(['r1', 'r2']);
    expect(repo.listViolationReportIds).toHaveBeenCalledWith(ViolationTargetType.STUDENT, 'stu1', since);
  });
});
