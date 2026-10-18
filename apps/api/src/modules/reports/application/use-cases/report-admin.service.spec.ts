import { ViolationReportStatus } from '@campusjob/contracts';
import { ReportAdminService } from './report-admin.service';

describe('ReportAdminService', () => {
  it('delegates to the repository', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue(null),
      listByStatus: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      markResolved: jest.fn().mockResolvedValue(true),
    };
    const service = new ReportAdminService(repo as any);

    expect(await service.findById('r1')).toBeNull();
    expect(await service.listByStatus(ViolationReportStatus.SUBSTANTIATED, 1, 10)).toEqual({ items: [], total: 0 });
    expect(repo.listByStatus).toHaveBeenCalledWith(ViolationReportStatus.SUBSTANTIATED, 1, 10);
    expect(await service.markResolved('r1', new Date())).toBe(true);
    expect(repo.markResolved).toHaveBeenCalledWith('r1', expect.any(Date));
  });
});
