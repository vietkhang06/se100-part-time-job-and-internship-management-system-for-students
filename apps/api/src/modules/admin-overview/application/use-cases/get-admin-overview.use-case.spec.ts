import { OverviewGroupKey as K, OverviewGroupStatus as S } from '@campusjob/contracts';
import { GetAdminOverviewUseCase } from './get-admin-overview.use-case';
import { IOverviewSource, OverviewSourceRegistry } from '../ports/overview-source.port';

const source = (key: K, total: number): IOverviewSource => ({
  key,
  collect: jest.fn().mockResolvedValue({
    total,
    breakdownLabel: 'Theo trạng thái',
    breakdown: [
      { key: 'A', label: 'A', count: total - 1 },
      { key: 'B', label: 'B', count: 1 },
    ],
  }),
});

describe('GetAdminOverviewUseCase', () => {
  let registry: OverviewSourceRegistry;
  let useCase: GetAdminOverviewUseCase;

  beforeEach(() => {
    registry = new OverviewSourceRegistry();
    useCase = new GetAdminOverviewUseCase(registry);
  });

  it('always returns the five UC54 groups in a fixed order', async () => {
    const result = await useCase.execute(new Date('2026-10-22T00:00:00.000Z'));

    expect(result.generatedAt).toBe('2026-10-22T00:00:00.000Z');
    expect(result.groups.map((g) => g.key)).toEqual([K.USERS, K.COMPANIES, K.JOBS, K.APPLICATIONS, K.REPORTS]);
  });

  it('marks groups without a source as UNAVAILABLE with the owner module, and never invents zeros', async () => {
    const result = await useCase.execute();
    const jobs = result.groups.find((g) => g.key === K.JOBS)!;

    expect(jobs.status).toBe(S.UNAVAILABLE);
    expect(jobs.total).toBeNull();
    expect(jobs.breakdown).toEqual([]);
    expect(jobs.unavailableReason).toContain('M03 Job');
  });

  it('returns real numbers from registered sources', async () => {
    registry.register(source(K.USERS, 10));
    registry.register(source(K.REPORTS, 4));

    const result = await useCase.execute();
    const users = result.groups.find((g) => g.key === K.USERS)!;
    const reports = result.groups.find((g) => g.key === K.REPORTS)!;

    expect(users.status).toBe(S.AVAILABLE);
    expect(users.total).toBe(10);
    expect(users.breakdownLabel).toBe('Theo trạng thái');
    expect(users.breakdown.reduce((sum, i) => sum + i.count, 0)).toBe(users.total);
    expect(reports.total).toBe(4);
    expect(users.unavailableReason).toBeNull();
  });

  it('isolates a failing source: that group is UNAVAILABLE and the others still work', async () => {
    registry.register(source(K.USERS, 10));
    registry.register({ key: K.REPORTS, collect: jest.fn().mockRejectedValue(new Error('db down')) });

    const result = await useCase.execute();

    expect(result.groups.find((g) => g.key === K.USERS)!.status).toBe(S.AVAILABLE);
    const reports = result.groups.find((g) => g.key === K.REPORTS)!;
    expect(reports.status).toBe(S.UNAVAILABLE);
    expect(reports.total).toBeNull();
    expect(reports.unavailableReason).toContain('Không truy vấn được');
  });

  it('lets a module register its source later (M03/M04 adapters)', async () => {
    registry.register(source(K.APPLICATIONS, 7));
    const result = await useCase.execute();
    expect(result.groups.find((g) => g.key === K.APPLICATIONS)!.total).toBe(7);
  });
});
