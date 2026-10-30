import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyVerificationStatus,
  JobStatus,
  JobType,
} from '@campusjob/contracts';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { InMemoryCompanyBranchRepository } from '../../infrastructure/persistence/in-memory-company-branch.repository';
import { InMemoryJobPostingRepository } from '../../infrastructure/persistence/in-memory-job-posting.repository';
import { PauseJobPostingUseCase } from './pause-job-posting.use-case';
import { ResumeJobPostingUseCase } from './resume-job-posting.use-case';
import { CloseJobPostingUseCase } from './close-job-posting.use-case';
import { CompanyEntity } from '../../domain/entities/company.entity';

describe('S2-M03-04: Job Lifecycle Transitions & Expiration Rules', () => {
  let companyRepo: InMemoryCompanyRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let branchRepo: InMemoryCompanyBranchRepository;
  let jobRepo: InMemoryJobPostingRepository;

  let pauseJobUseCase: PauseJobPostingUseCase;
  let resumeJobUseCase: ResumeJobPostingUseCase;
  let closeJobUseCase: CloseJobPostingUseCase;

  const ownerUserId = 'user-owner-1';
  const otherOwnerUserId = 'user-other-owner';
  let companyId: string;
  let branchId: string;

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    memberRepo = new InMemoryCompanyMemberRepository();
    branchRepo = new InMemoryCompanyBranchRepository();
    jobRepo = new InMemoryJobPostingRepository();

    pauseJobUseCase = new PauseJobPostingUseCase(jobRepo, memberRepo);
    resumeJobUseCase = new ResumeJobPostingUseCase(jobRepo, memberRepo, companyRepo);
    closeJobUseCase = new CloseJobPostingUseCase(jobRepo, memberRepo);

    // Setup company verified
    const company = await companyRepo.create({
      name: 'Alpha Software',
      taxId: '1112223334',
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
      branchName: 'Main Branch',
      addressLine: '100 Dien Bien Phu',
      city: 'Da Nang',
    });
    branchId = branch.id;

    // Setup Other company
    const otherCompany = await companyRepo.create({
      name: 'Beta Global',
      taxId: '9998887776',
      verificationStatus: 'VERIFIED',
    });
    await memberRepo.create({
      companyId: otherCompany.id,
      userId: otherOwnerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });
  });

  describe('Pause Job (OPEN -> PAUSED)', () => {
    it('should successfully pause an OPEN job', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Software Architect',
        description: 'Lead design',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Architecture'],
        quantity: 1,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.OPEN,
      });

      const res = await pauseJobUseCase.execute(ownerUserId, job.id);
      expect(res.job.status).toBe(JobStatus.PAUSED);
    });

    it('should be idempotent if job is already PAUSED', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Paused Job',
        description: 'Description',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['DevOps'],
        quantity: 1,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.PAUSED,
      });

      const res = await pauseJobUseCase.execute(ownerUserId, job.id);
      expect(res.job.status).toBe(JobStatus.PAUSED);
    });

    it('should reject pause if job is not OPEN (e.g. PENDING_APPROVAL)', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Pending Job',
        description: 'Description',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['QA'],
        quantity: 1,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.PENDING_APPROVAL,
      });

      await expect(
        pauseJobUseCase.execute(ownerUserId, job.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should automatically close job (CLOSED) and reject pause if job deadline is in the past (F6 Expiry Rule)', async () => {
      const expiredOpenJob = await jobRepo.create({
        companyId,
        branchId,
        title: 'Expired Open Job',
        description: 'Description',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['QA'],
        quantity: 1,
        deadline: new Date(Date.now() - 3600000), // Expired 1 hour ago
        status: JobStatus.OPEN,
      });

      await expect(
        pauseJobUseCase.execute(ownerUserId, expiredOpenJob.id),
      ).rejects.toThrow(BadRequestException);

      const reloaded = await jobRepo.findById(expiredOpenJob.id);
      expect(reloaded?.status).toBe(JobStatus.CLOSED);
    });

    it('should deny pause if requested by another company owner', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Target Job',
        description: 'Description',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['QA'],
        quantity: 1,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.OPEN,
      });

      await expect(
        pauseJobUseCase.execute(otherOwnerUserId, job.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Resume Job (PAUSED -> OPEN) & Expiration & Company Gates', () => {
    it('should successfully resume a PAUSED job when unexpired and company verified', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Mobile Engineer Flutter',
        description: 'Build cross platform apps',
        industry: 'Mobile',
        type: JobType.FULL_TIME,
        skills: ['Flutter', 'Dart'],
        quantity: 2,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.PAUSED,
      });

      const res = await resumeJobUseCase.execute(ownerUserId, job.id);
      expect(res.job.status).toBe(JobStatus.OPEN);
    });

    it('should be idempotent if job is already OPEN', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Open Job',
        description: 'Description',
        industry: 'Mobile',
        type: JobType.FULL_TIME,
        skills: ['Flutter'],
        quantity: 1,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.OPEN,
      });

      const res = await resumeJobUseCase.execute(ownerUserId, job.id);
      expect(res.job.status).toBe(JobStatus.OPEN);
    });

    it('should block resume and auto-close job to CLOSED if job deadline is in the past (F6 Expiry Rule)', async () => {
      const expiredJob = await jobRepo.create({
        companyId,
        branchId,
        title: 'Expired Job',
        description: 'Description',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Java'],
        quantity: 1,
        deadline: new Date(Date.now() - 3600000), // Expired 1 hour ago
        status: JobStatus.PAUSED,
      });

      await expect(
        resumeJobUseCase.execute(ownerUserId, expiredJob.id),
      ).rejects.toThrow(BadRequestException);

      const reloaded = await jobRepo.findById(expiredJob.id);
      expect(reloaded?.status).toBe(JobStatus.CLOSED);
    });

    it('should reject resume with ForbiddenException if job was hidden by moderation (hiddenByModeration flag prevents bypass)', async () => {
      const moderatorHiddenJob = await jobRepo.create({
        companyId,
        branchId,
        title: 'Hidden Job by Mod',
        description: 'Description',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Java'],
        quantity: 1,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.PAUSED,
      });

      await jobRepo.update(moderatorHiddenJob.id, {
        hiddenByModeration: true,
      });

      await expect(
        resumeJobUseCase.execute(ownerUserId, moderatorHiddenJob.id),
      ).rejects.toThrow(ForbiddenException);

      const reloaded = await jobRepo.findById(moderatorHiddenJob.id);
      expect(reloaded?.status).toBe(JobStatus.PAUSED);
      expect(reloaded?.hiddenByModeration).toBe(true);
    });

    it('should block resume if company is not active/verified (Active Company Gate)', async () => {
      // Revert company to UNVERIFIED
      const currentComp = (await companyRepo.findById(companyId))!;
      const unverifiedComp = new CompanyEntity({
        id: currentComp.id,
        name: currentComp.name,
        taxId: currentComp.taxId,
        legalName: currentComp.legalName,
        representativeName: currentComp.representativeName,
        website: currentComp.website,
        industry: currentComp.industry,
        companySize: currentComp.companySize,
        description: currentComp.description,
        logoUrl: currentComp.logoUrl,
        email: currentComp.email,
        phone: currentComp.phone,
        address: currentComp.address,
        verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
      });
      await companyRepo.save(unverifiedComp);

      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Pending Company Job',
        description: 'Description',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Java'],
        quantity: 1,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.PAUSED,
      });

      await expect(
        resumeJobUseCase.execute(ownerUserId, job.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deny resume from another company owner', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Secret Job',
        description: 'Description',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Java'],
        quantity: 1,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.PAUSED,
      });

      await expect(
        resumeJobUseCase.execute(otherOwnerUserId, job.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Close Job (OPEN/PAUSED/PENDING -> CLOSED)', () => {
    it('should close job from OPEN status', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Active Job',
        description: 'Description',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Go'],
        quantity: 1,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.OPEN,
      });

      const res = await closeJobUseCase.execute(ownerUserId, job.id);
      expect(res.job.status).toBe(JobStatus.CLOSED);
    });

    it('should close job from PAUSED status', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Paused Job',
        description: 'Description',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Go'],
        quantity: 1,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.PAUSED,
      });

      const res = await closeJobUseCase.execute(ownerUserId, job.id);
      expect(res.job.status).toBe(JobStatus.CLOSED);
    });

    it('should be idempotent if job is already CLOSED', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Closed Job',
        description: 'Description',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Go'],
        quantity: 1,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.CLOSED,
      });

      const res = await closeJobUseCase.execute(ownerUserId, job.id);
      expect(res.job.status).toBe(JobStatus.CLOSED);
    });

    it('should deny close from another company owner', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Target Job',
        description: 'Description',
        industry: 'Tech',
        type: JobType.FULL_TIME,
        skills: ['Go'],
        quantity: 1,
        deadline: new Date(Date.now() + 7 * 86400000),
        status: JobStatus.OPEN,
      });

      await expect(
        closeJobUseCase.execute(otherOwnerUserId, job.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
