import { ConfigService } from '@nestjs/config';
import {
  JobStatus,
  JobType,
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyVerificationStatus,
} from '@campusjob/contracts';
import { JobExpirySchedulerService } from './job-expiry-scheduler.service';
import { InMemoryJobPostingRepository } from '../../infrastructure/persistence/in-memory-job-posting.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { IJobExpiryReminderLogRepository } from '../../domain/repositories/job-expiry-reminder-log.repository.interface';
import { IJobExpiryNotifier } from '../../domain/ports/job-expiry-notifier.port';

describe('JobExpirySchedulerService (S6-M03-02)', () => {
  let service: JobExpirySchedulerService;
  let jobRepo: InMemoryJobPostingRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let companyRepo: InMemoryCompanyRepository;
  let reminderLogRepo: IJobExpiryReminderLogRepository;
  let notifier: jest.Mocked<IJobExpiryNotifier>;
  let sentReminders: Set<string>;

  beforeEach(() => {
    jobRepo = new InMemoryJobPostingRepository();
    memberRepo = new InMemoryCompanyMemberRepository();
    companyRepo = new InMemoryCompanyRepository();
    sentReminders = new Set();

    reminderLogRepo = {
      hasBeenReminded: jest.fn().mockImplementation(async (jobId, recipientId, deadlineDate) => {
        const key = `${jobId}:${recipientId}:${deadlineDate}`;
        return sentReminders.has(key);
      }),
      recordReminder: jest.fn().mockImplementation(async (jobId, recipientId, deadlineDate) => {
        const key = `${jobId}:${recipientId}:${deadlineDate}`;
        sentReminders.add(key);
      }),
    };

    notifier = {
      sendExpiryReminder: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      get: jest.fn().mockReturnValue('false'),
    } as unknown as ConfigService;

    service = new JobExpirySchedulerService(
      configService,
      jobRepo,
      memberRepo,
      companyRepo,
      reminderLogRepo,
      notifier,
    );
  });

  it('Step 1: tự động đóng các tin tuyển dụng đã qua hạn (deadline < now)', async () => {
    const past = new Date(Date.now() - 3600 * 1000);
    const expiredJob = await jobRepo.create({
      companyId: 'comp-1',
      branchId: 'branch-1',
      title: 'Expired Job',
      description: 'Desc',
      industry: 'IT',
      type: JobType.FULL_TIME,
      skills: ['JS'],
      quantity: 1,
      isSalaryNegotiable: true,
      deadline: past,
      status: JobStatus.OPEN,
    });

    const result = await service.runJobExpiryCheck();

    expect(result.closedCount).toBe(1);
    const updated = await jobRepo.findById(expiredJob.id);
    expect(updated?.status).toBe(JobStatus.CLOSED);
  });

  it('Step 2: gửi email nhắc nhở trước 3 ngày cho Owner của doanh nghiệp', async () => {
    const comp = await companyRepo.create({
      name: 'Acme Corp',
      taxId: 'TAX-001',
      email: 'acme@example.com',
      phone: '0123456789',
      address: '123 St',
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });

    await memberRepo.create({
      companyId: comp.id,
      userId: 'user-owner',
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    const deadline = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    const expiringJob = await jobRepo.create({
      companyId: comp.id,
      branchId: 'branch-1',
      title: 'Expiring Soon Job',
      description: 'Desc',
      industry: 'IT',
      type: JobType.FULL_TIME,
      skills: ['NestJS'],
      quantity: 1,
      isSalaryNegotiable: true,
      deadline,
      status: JobStatus.OPEN,
    });

    const result = await service.runJobExpiryCheck();

    expect(result.remindersSent).toBe(1);
    expect(notifier.sendExpiryReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: expiringJob.id,
        recipientEmail: 'user-user-owner@example.com',
        recipientName: 'Member user-owner',
        daysRemaining: expect.any(Number),
      }),
    );
    expect(reminderLogRepo.recordReminder).toHaveBeenCalled();
  });

  it('Step 2 Khử trùng: chạy lần 2 không gửi lại email nếu đã ghi log trước đó', async () => {
    const comp = await companyRepo.create({
      name: 'Acme Corp',
      taxId: 'TAX-002',
      email: 'acme2@example.com',
      phone: '0123456789',
      address: '123 St',
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });

    await memberRepo.create({
      companyId: comp.id,
      userId: 'user-owner',
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    const deadline = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    await jobRepo.create({
      companyId: comp.id,
      branchId: 'branch-1',
      title: 'Expiring Job 2',
      description: 'Desc',
      industry: 'IT',
      type: JobType.FULL_TIME,
      skills: ['NestJS'],
      quantity: 1,
      isSalaryNegotiable: true,
      deadline,
      status: JobStatus.OPEN,
    });

    const run1 = await service.runJobExpiryCheck();
    expect(run1.remindersSent).toBe(1);

    const run2 = await service.runJobExpiryCheck();
    expect(run2.remindersSent).toBe(0);
    expect(notifier.sendExpiryReminder).toHaveBeenCalledTimes(1);
  });

  it('overlapping runs do not double-send or double-close (chống chạy chồng chéo)', async () => {
    const past = new Date(Date.now() - 3600 * 1000);
    await jobRepo.create({
      companyId: 'comp-1',
      branchId: 'branch-1',
      title: 'Expired Job Overlap',
      description: 'Desc',
      industry: 'IT',
      type: JobType.FULL_TIME,
      skills: ['JS'],
      quantity: 1,
      isSalaryNegotiable: true,
      deadline: past,
      status: JobStatus.OPEN,
    });

    const comp = await companyRepo.create({
      name: 'Overlap Corp',
      taxId: 'TAX-OVERLAP',
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });

    await memberRepo.create({
      companyId: comp.id,
      userId: 'user-owner-overlap',
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    const deadline = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    await jobRepo.create({
      companyId: comp.id,
      branchId: 'branch-1',
      title: 'Expiring Job Overlap',
      description: 'Desc',
      industry: 'IT',
      type: JobType.FULL_TIME,
      skills: ['NestJS'],
      quantity: 1,
      isSalaryNegotiable: true,
      deadline,
      status: JobStatus.OPEN,
    });

    // Giả lập notifier mất 50ms để hoàn thành
    notifier.sendExpiryReminder.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 50)),
    );

    // Kích hoạt 2 lần chạy đồng thời
    const [result1, result2] = await Promise.all([
      service.runJobExpiryCheck('run-1'),
      service.runJobExpiryCheck('run-2'),
    ]);

    // Một lần chạy thực thi bình thường, lần chạy còn lại bị bỏ qua vì isRunning = true
    const executedRun = result1.errors.length === 0 ? result1 : result2;
    const skippedRun = result1.errors.length === 0 ? result2 : result1;

    expect(executedRun.closedCount).toBe(1);
    expect(executedRun.remindersSent).toBe(1);

    expect(skippedRun.closedCount).toBe(0);
    expect(skippedRun.remindersSent).toBe(0);
    expect(skippedRun.errors).toContain('Scheduler already running');

    // Tổng số lần gọi gửi email vẫn chỉ là 1, không bị double-send
    expect(notifier.sendExpiryReminder).toHaveBeenCalledTimes(1);
  });

  it('email failure does not block closing and is retried next run (lỗi email không chặn đóng tin và được retry lần sau)', async () => {
    const past = new Date(Date.now() - 3600 * 1000);
    const expired = await jobRepo.create({
      companyId: 'comp-retry',
      branchId: 'branch-1',
      title: 'Expired Job Retry',
      description: 'Desc',
      industry: 'IT',
      type: JobType.FULL_TIME,
      skills: ['JS'],
      quantity: 1,
      isSalaryNegotiable: true,
      deadline: past,
      status: JobStatus.OPEN,
    });

    const comp = await companyRepo.create({
      name: 'Retry Corp',
      taxId: 'TAX-RETRY',
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });

    await memberRepo.create({
      companyId: comp.id,
      userId: 'user-owner-retry',
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    const deadline = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    await jobRepo.create({
      companyId: comp.id,
      branchId: 'branch-1',
      title: 'Expiring Job Retry',
      description: 'Desc',
      industry: 'IT',
      type: JobType.FULL_TIME,
      skills: ['NestJS'],
      quantity: 1,
      isSalaryNegotiable: true,
      deadline,
      status: JobStatus.OPEN,
    });

    // Lần 1: Email fail
    notifier.sendExpiryReminder.mockRejectedValueOnce(new Error('SMTP Network Failure'));

    const run1 = await service.runJobExpiryCheck('corr-fail');
    expect(run1.closedCount).toBe(1); // Tin quá hạn vẫn đóng thành công!
    expect(run1.remindersSent).toBe(0);
    expect(run1.errors.length).toBeGreaterThan(0);

    const updatedExpired = await jobRepo.findById(expired.id);
    expect(updatedExpired?.status).toBe(JobStatus.CLOSED);

    // Lần 2: Email hồi phục và gửi thành công (Retry)
    notifier.sendExpiryReminder.mockResolvedValueOnce(undefined);
    const run2 = await service.runJobExpiryCheck('corr-success');
    expect(run2.remindersSent).toBe(1);
    expect(run2.errors).toHaveLength(0);
    expect(sentReminders.size).toBe(1);
  });

  it('correlation ID logged: mỗi lần chạy ghi nhận correlation ID xuyên suốt', async () => {
    const customCorrelationId = 'custom-trace-uuid-12345';
    const result = await service.runJobExpiryCheck(customCorrelationId);

    expect(result.correlationId).toBe(customCorrelationId);
    expect(typeof result.correlationId).toBe('string');
  });
});
