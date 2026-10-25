import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyVerificationStatus,
  JobStatus,
  JobType,
  ModerationDecisionType,
  ModerationStatus,
  ModerationTargetType,
} from '@campusjob/contracts';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { InMemoryCompanyBranchRepository } from '../../infrastructure/persistence/in-memory-company-branch.repository';
import { InMemoryJobPostingRepository } from '../../infrastructure/persistence/in-memory-job-posting.repository';
import { SubmitJobPostingUseCase } from './submit-job-posting.use-case';
import { JobModerationTargetHandler } from './job-moderation-target.handler';
import { ModerationQueueAdapter } from '../../infrastructure/adapters/moderation-queue.adapter';
import {
  IJobModerationQueuePort,
  JobModerationEnqueueResult,
} from '../../domain/ports/job-moderation-queue.port';
import { JobPostingEntity } from '../../domain/entities/job-posting.entity';
import { ModerationDecisionContext } from '../../../moderation/application/ports/moderation-target-handler.port';
import { CompanyEntity } from '../../domain/entities/company.entity';

/**
 * In-memory test-only fake for C-16 moderation queue
 * TUYỆT ĐỐI chỉ dùng trong test, không bao giờ đăng ký vào production module.
 */
class FakeJobModerationQueue implements IJobModerationQueuePort {
  public submissions: Array<{ jobId: string; submitterId: string }> = [];
  public callCount = 0;

  async enqueueJob(
    job: JobPostingEntity,
    submitterId: string,
  ): Promise<JobModerationEnqueueResult> {
    this.callCount++;
    const alreadyExists = this.submissions.some((s) => s.jobId === job.id);
    if (alreadyExists) {
      return {
        itemId: `mod-item-${job.id}`,
        round: 1,
        outcome: 'ALREADY_PENDING',
      };
    }
    this.submissions.push({ jobId: job.id, submitterId });
    return {
      itemId: `mod-item-${job.id}`,
      round: 1,
      outcome: 'CREATED',
    };
  }
}

describe('S2-M03-05 & S5-M03-01: Job Moderation Contract & Adapter Integration', () => {
  let companyRepo: InMemoryCompanyRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let branchRepo: InMemoryCompanyBranchRepository;
  let jobRepo: InMemoryJobPostingRepository;
  let fakeModerationQueue: FakeJobModerationQueue;

  let submitJobUseCase: SubmitJobPostingUseCase;
  let moderationHandler: JobModerationTargetHandler;

  const ownerUserId = 'user-owner-1';
  const otherOwnerUserId = 'user-other-owner';
  let companyId: string;
  let branchId: string;

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    memberRepo = new InMemoryCompanyMemberRepository();
    branchRepo = new InMemoryCompanyBranchRepository();
    jobRepo = new InMemoryJobPostingRepository();
    fakeModerationQueue = new FakeJobModerationQueue();

    submitJobUseCase = new SubmitJobPostingUseCase(
      jobRepo,
      memberRepo,
      fakeModerationQueue,
    );
    moderationHandler = new JobModerationTargetHandler(jobRepo, companyRepo);

    // Setup company verified
    const company = await companyRepo.create({
      name: 'VNG Innovation',
      taxId: '5556667778',
      verificationStatus: 'VERIFIED',
    });
    companyId = company.id;

    await memberRepo.create({
      companyId,
      userId: ownerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    const branch = await branchRepo.create({
      companyId,
      branchName: 'Campus Branch',
      addressLine: 'VNG Campus, District 7',
      city: 'Ho Chi Minh',
    });
    branchId = branch.id;

    // Setup another company
    const otherCompany = await companyRepo.create({
      name: 'Zeta Software',
      taxId: '3334445556',
      verificationStatus: 'VERIFIED',
    });
    await memberRepo.create({
      companyId: otherCompany.id,
      userId: otherOwnerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });
  });

  describe('Submit Job to C-16 Queue (S5-M03-01)', () => {
    it('should submit job creating exactly one queue item', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Backend Golang Engineer',
        description: 'Microservices with Golang & gRPC',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Golang', 'gRPC'],
        quantity: 2,
        deadline: new Date(Date.now() + 14 * 86400000),
        status: JobStatus.PENDING_APPROVAL,
      });

      const res = await submitJobUseCase.execute(ownerUserId, job.id);
      expect(res.moderation.outcome).toBe('CREATED');
      expect(res.moderation.itemId).toBe(`mod-item-${job.id}`);
      expect(fakeModerationQueue.submissions.length).toBe(1);
    });

    it('should handle duplicate submission idempotently (outcome: ALREADY_PENDING)', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Backend Golang Engineer',
        description: 'Microservices with Golang & gRPC',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Golang'],
        quantity: 1,
        deadline: new Date(Date.now() + 14 * 86400000),
        status: JobStatus.PENDING_APPROVAL,
      });

      // First submit
      await submitJobUseCase.execute(ownerUserId, job.id);
      expect(fakeModerationQueue.submissions.length).toBe(1);

      // Second submit
      const res2 = await submitJobUseCase.execute(ownerUserId, job.id);
      expect(res2.moderation.outcome).toBe('ALREADY_PENDING');
      expect(fakeModerationQueue.submissions.length).toBe(1); // Does not create duplicate logical items
    });

    it('should reject submission if job is already OPEN or CLOSED', async () => {
      const openJob = await jobRepo.create({
        companyId,
        branchId,
        title: 'Open Job',
        description: 'Desc',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Golang'],
        quantity: 1,
        deadline: new Date(Date.now() + 14 * 86400000),
        status: JobStatus.OPEN,
      });

      await expect(
        submitJobUseCase.execute(ownerUserId, openJob.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deny submission from another company owner', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Owned Job',
        description: 'Desc',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Golang'],
        quantity: 1,
        deadline: new Date(Date.now() + 14 * 86400000),
        status: JobStatus.PENDING_APPROVAL,
      });

      await expect(
        submitJobUseCase.execute(otherOwnerUserId, job.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should fail closed when moderation queue adapter has no active provider (Production isolation)', async () => {
      const unconfiguredAdapter = new ModerationQueueAdapter(undefined);
      const productionIsolatedUseCase = new SubmitJobPostingUseCase(
        jobRepo,
        memberRepo,
        unconfiguredAdapter,
      );

      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Target Job',
        description: 'Desc',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Golang'],
        quantity: 1,
        deadline: new Date(Date.now() + 14 * 86400000),
        status: JobStatus.PENDING_APPROVAL,
      });

      await expect(
        productionIsolatedUseCase.execute(ownerUserId, job.id),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('Receive Moderation Decision Callback (S5-M03-01)', () => {
    let testJob: JobPostingEntity;

    beforeEach(async () => {
      testJob = await jobRepo.create({
        companyId,
        branchId,
        title: 'Data Analyst Intern',
        description: 'Analyze data with SQL and Python',
        industry: 'Data',
        type: JobType.INTERNSHIP,
        skills: ['Python', 'SQL'],
        quantity: 1,
        deadline: new Date(Date.now() + 14 * 86400000),
        status: JobStatus.PENDING_APPROVAL,
      });
    });

    it('should transition job to OPEN on APPROVE when unexpired and company verified', async () => {
      const context: ModerationDecisionContext = {
        itemId: 'mod-1',
        decisionId: 'dec-1',
        targetType: ModerationTargetType.JOB,
        targetId: testJob.id,
        decision: ModerationDecisionType.APPROVE,
        newStatus: ModerationStatus.APPROVED,
        reason: null,
        proposedAction: null,
        reviewerId: 'mod-user-1',
      };

      await moderationHandler.applyDecision(context);

      const updated = await jobRepo.findById(testJob.id);
      expect(updated?.status).toBe(JobStatus.OPEN);
    });

    it('should block APPROVE if job is expired', async () => {
      await jobRepo.update(testJob.id, {
        deadline: new Date(Date.now() - 3600000), // Past deadline
      });

      const context: ModerationDecisionContext = {
        itemId: 'mod-1',
        decisionId: 'dec-1',
        targetType: ModerationTargetType.JOB,
        targetId: testJob.id,
        decision: ModerationDecisionType.APPROVE,
        newStatus: ModerationStatus.APPROVED,
        reason: null,
        proposedAction: null,
        reviewerId: 'mod-user-1',
      };

      await expect(moderationHandler.applyDecision(context)).rejects.toThrow(
        BadRequestException,
      );

      const updated = await jobRepo.findById(testJob.id);
      expect(updated?.status).toBe(JobStatus.PENDING_APPROVAL); // Stays non-public
    });

    it('should block APPROVE if company is not active/verified', async () => {
      const comp = (await companyRepo.findById(companyId))!;
      await companyRepo.save(
        new CompanyEntity({
          id: comp.id,
          name: comp.name,
          taxId: comp.taxId,
          legalName: comp.legalName,
          representativeName: comp.representativeName,
          website: comp.website,
          industry: comp.industry,
          companySize: comp.companySize,
          description: comp.description,
          logoUrl: comp.logoUrl,
          email: comp.email,
          phone: comp.phone,
          address: comp.address,
          verificationStatus: CompanyVerificationStatus.REJECTED,
        }),
      );

      const context: ModerationDecisionContext = {
        itemId: 'mod-1',
        decisionId: 'dec-1',
        targetType: ModerationTargetType.JOB,
        targetId: testJob.id,
        decision: ModerationDecisionType.APPROVE,
        newStatus: ModerationStatus.APPROVED,
        reason: null,
        proposedAction: null,
        reviewerId: 'mod-user-1',
      };

      await expect(moderationHandler.applyDecision(context)).rejects.toThrow(
        BadRequestException,
      );

      const updated = await jobRepo.findById(testJob.id);
      expect(updated?.status).toBe(JobStatus.PENDING_APPROVAL); // Stays non-public
    });

    it('should be idempotent on duplicate APPROVE callbacks', async () => {
      const context: ModerationDecisionContext = {
        itemId: 'mod-1',
        decisionId: 'dec-1',
        targetType: ModerationTargetType.JOB,
        targetId: testJob.id,
        decision: ModerationDecisionType.APPROVE,
        newStatus: ModerationStatus.APPROVED,
        reason: null,
        proposedAction: null,
        reviewerId: 'mod-user-1',
      };

      await moderationHandler.applyDecision(context);
      // Second call (idempotent resync)
      await expect(moderationHandler.applyDecision(context)).resolves.not.toThrow();

      const updated = await jobRepo.findById(testJob.id);
      expect(updated?.status).toBe(JobStatus.OPEN);
    });

    it('should reject REJECT decision without reason (reject bắt buộc reason)', async () => {
      const contextWithoutReason: ModerationDecisionContext = {
        itemId: 'mod-1',
        decisionId: 'dec-2',
        targetType: ModerationTargetType.JOB,
        targetId: testJob.id,
        decision: ModerationDecisionType.REJECT,
        newStatus: ModerationStatus.REJECTED,
        reason: '   ', // Empty/whitespace
        proposedAction: null,
        reviewerId: 'mod-user-1',
      };

      await expect(
        moderationHandler.applyDecision(contextWithoutReason),
      ).rejects.toThrow(BadRequestException);
    });

    it('should preserve non-public state on REJECT (never map to OPEN or CLOSED)', async () => {
      const rejectContext: ModerationDecisionContext = {
        itemId: 'mod-1',
        decisionId: 'dec-2',
        targetType: ModerationTargetType.JOB,
        targetId: testJob.id,
        decision: ModerationDecisionType.REJECT,
        newStatus: ModerationStatus.REJECTED,
        reason: 'Nội dung tin tuyển dụng chứa thông tin liên lạc không hợp lệ.',
        proposedAction: null,
        reviewerId: 'mod-user-1',
      };

      await moderationHandler.applyDecision(rejectContext);

      const updated = await jobRepo.findById(testJob.id);
      // Phải giữ nguyên non-public (PENDING_APPROVAL), tuyệt đối không tự ý gán sang OPEN hay CLOSED
      expect(updated?.status).toBe(JobStatus.PENDING_APPROVAL);
      expect(updated?.status).not.toBe(JobStatus.OPEN);
      expect(updated?.status).not.toBe(JobStatus.CLOSED);
    });

    it('should transition job to PAUSED on HIDE decision with valid reason', async () => {
      // First make job OPEN
      await jobRepo.update(testJob.id, { status: JobStatus.OPEN });

      const hideContext: ModerationDecisionContext = {
        itemId: 'mod-1',
        decisionId: 'dec-3',
        targetType: ModerationTargetType.JOB,
        targetId: testJob.id,
        decision: ModerationDecisionType.HIDE,
        newStatus: ModerationStatus.HIDDEN,
        reason: 'Phát hiện dấu hiệu lừa đảo trong thông tin tuyển dụng.',
        proposedAction: null,
        reviewerId: 'mod-user-1',
      };

      await moderationHandler.applyDecision(hideContext);

      const updated = await jobRepo.findById(testJob.id);
      expect(updated?.status).toBe(JobStatus.PAUSED);
    });
  });
});
