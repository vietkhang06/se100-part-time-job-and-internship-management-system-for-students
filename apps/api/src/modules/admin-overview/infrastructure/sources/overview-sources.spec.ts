import { UserRole, ViolationReportStatus } from '@campusjob/contracts';
import { UsersOverviewSource } from './users-overview.source';
import { ReportsOverviewSource } from './reports-overview.source';
import { PrismaService } from '../../../../shared/database/prisma.service';

describe('UsersOverviewSource', () => {
  it('counts users by role, fills missing roles with 0 and totals the breakdown', async () => {
    const prisma = new PrismaService();
    jest.spyOn(prisma.user, 'groupBy').mockResolvedValue([
      { role: 'STUDENT', _count: { _all: 5 } },
      { role: 'EMPLOYER', _count: { _all: 2 } },
    ] as Awaited<ReturnType<typeof prisma.user.groupBy>>);

    const result = await new UsersOverviewSource(prisma).collect();

    expect(result.total).toBe(7);
    expect(result.breakdown.map((b) => b.key)).toEqual(Object.values(UserRole));
    expect(result.breakdown.find((b) => b.key === 'MODERATOR')!.count).toBe(0);
    expect(result.breakdown.find((b) => b.key === 'STUDENT')!.count).toBe(5);
    expect(result.breakdown.reduce((s, b) => s + b.count, 0)).toBe(result.total);
  });
});

describe('ReportsOverviewSource', () => {
  it('counts reports by status, fills missing statuses with 0 and totals the breakdown', async () => {
    const prisma = new PrismaService();
    jest.spyOn(prisma.violationReport, 'groupBy').mockResolvedValue([
      { status: 'UNDER_REVIEW', _count: { _all: 3 } },
      { status: 'RESOLVED', _count: { _all: 1 } },
    ] as Awaited<ReturnType<typeof prisma.violationReport.groupBy>>);

    const result = await new ReportsOverviewSource(prisma).collect();

    expect(result.total).toBe(4);
    expect(result.breakdown.map((b) => b.key)).toEqual(Object.values(ViolationReportStatus));
    expect(result.breakdown.find((b) => b.key === 'SUBMITTED')!.count).toBe(0);
    expect(result.breakdown.find((b) => b.key === 'UNDER_REVIEW')!.count).toBe(3);
  });

  it('returns zero totals for an empty table (real zero, not a missing source)', async () => {
    const prisma = new PrismaService();
    jest.spyOn(prisma.violationReport, 'groupBy').mockResolvedValue([]);
    const result = await new ReportsOverviewSource(prisma).collect();
    expect(result.total).toBe(0);
  });
});
