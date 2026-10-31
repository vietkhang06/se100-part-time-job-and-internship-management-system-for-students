import { NotFoundException } from '@nestjs/common';
import { JobStatus, JobType } from '@campusjob/contracts';
import { GetAdminJobMetricsUseCase } from './get-admin-job-metrics.use-case';
import { InMemoryJobPostingRepository } from '../../infrastructure/persistence/in-memory-job-posting.repository';
import { JobPostingEntity } from '../../domain/entities/job-posting.entity';

describe('GetAdminJobMetricsUseCase (S6-M03-01)', () => {
  let jobRepo: InMemoryJobPostingRepository;
  let useCase: GetAdminJobMetricsUseCase;

  let job1: JobPostingEntity;
  let job2: JobPostingEntity;

  beforeEach(async () => {
    jobRepo = new InMemoryJobPostingRepository();
    useCase = new GetAdminJobMetricsUseCase(jobRepo);

    job1 = await jobRepo.create({
      companyId: 'comp-1',
      branchId: 'branch-1',
      title: 'Dev 1',
      description: 'Desc 1',
      industry: 'IT',
      type: JobType.FULL_TIME,
      skills: ['JS'],
      quantity: 1,
      isSalaryNegotiable: true,
      deadline: new Date(Date.now() + 86400000),
      status: JobStatus.OPEN,
    });

    job2 = await jobRepo.create({
      companyId: 'comp-2',
      branchId: 'branch-2',
      title: 'Dev 2',
      description: 'Desc 2',
      industry: 'IT',
      type: JobType.PART_TIME,
      skills: ['TS'],
      quantity: 2,
      isSalaryNegotiable: true,
      deadline: new Date(Date.now() + 86400000),
      status: JobStatus.CLOSED,
    });

    // Record some views
    await jobRepo.recordPublicView(job1.id, 'user:1');
    await jobRepo.recordPublicView(job1.id, 'anon:hash1');
  });

  it('trả về toàn bộ số liệu tổng hợp của hệ thống qua executeAggregate()', async () => {
    const res = await useCase.executeAggregate();

    expect(res.totalJobs).toBe(2);
    expect(res.totalViews).toBe(2);
    expect(res.totalSaves).toBe(0);
    expect(res.jobs).toHaveLength(2);

    const job1Metrics = res.jobs.find((j: any) => j.jobId === job1.id);
    expect(job1Metrics?.viewCount).toBe(2);
  });

  it('trả về số liệu chi tiết của 1 tin qua executeSingle() khi truyền jobId hợp lệ', async () => {
    const res = await useCase.executeSingle(job1.id);

    expect(res.jobId).toBe(job1.id);
    expect(res.viewCount).toBe(2);
    expect(res.saveCount).toBe(0);
  });

  it('ném NotFoundException khi truyền jobId không tồn tại', async () => {
    await expect(useCase.executeSingle('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
