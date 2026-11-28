import { NotFoundException } from '@nestjs/common';
import {
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyVerificationStatus,
  JobStatus,
  JobType,
} from '@campusjob/contracts';
import { CompanyEntity } from '../../domain/entities/company.entity';
import { InMemoryCompanyRepository } from '../persistence/in-memory-company.repository';
import { InMemoryCompanyVerificationRepository } from '../persistence/in-memory-company-verification.repository';
import { InMemoryJobPostingRepository } from '../persistence/in-memory-job-posting.repository';
import { InMemoryCompanyMemberRepository } from '../persistence/in-memory-company-member.repository';
import { CompanySanctionHandlerRegistry } from '../../../sanctions/application/ports/company-sanction-handler.port';
import { CompanySanctionAdapter } from './company-sanction.adapter';

describe('CompanySanctionAdapter (S5-M05-02 / C-06, C-08, C-19)', () => {
  let adapter: CompanySanctionAdapter;
  let companyRepo: InMemoryCompanyRepository;
  let verificationRepo: InMemoryCompanyVerificationRepository;
  let jobRepo: InMemoryJobPostingRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let registry: CompanySanctionHandlerRegistry;

  const companyId = 'company-test-1';
  const otherCompanyId = 'company-test-2';
  const ownerUserId = 'user-owner-1';
  const branchId = 'branch-test-1';
  const sanctionId = 'sanction-uuid-1';
  const reason = 'Vi phạm nghiêm trọng quy định tuyển dụng';

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    verificationRepo = new InMemoryCompanyVerificationRepository();
    jobRepo = new InMemoryJobPostingRepository();
    memberRepo = new InMemoryCompanyMemberRepository();
    registry = new CompanySanctionHandlerRegistry();

    adapter = new CompanySanctionAdapter(
      companyRepo,
      verificationRepo,
      jobRepo,
      memberRepo,
      registry,
    );

    // Initialize module hook
    adapter.onModuleInit();

    // Seed test company (VERIFIED)
    const company = new CompanyEntity({
      id: companyId,
      name: 'VinTech Solutions',
      taxId: '0102030405',
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });
    await companyRepo.save(company);

    // Seed owner member
    await memberRepo.create({
      companyId,
      userId: ownerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    // Seed other company
    const otherCompany = new CompanyEntity({
      id: otherCompanyId,
      name: 'Other Corp',
      taxId: '9999999999',
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });
    await companyRepo.save(otherCompany);
  });

  describe('Registration & Wiring (AC-02)', () => {
    it('should register itself into CompanySanctionHandlerRegistry upon onModuleInit', () => {
      expect(registry.get()).toBe(adapter);
    });
  });

  describe('describe (C-19 target info resolution)', () => {
    it('should return null when company does not exist', async () => {
      const result = await adapter.describe('non-existent-company');
      expect(result).toBeNull();
    });

    it('should return ownerUserId and company name for an existing company with an active OWNER', async () => {
      const result = await adapter.describe(companyId);
      expect(result).toEqual({
        ownerUserId,
        name: 'VinTech Solutions',
      });
    });

    it('should fallback to any active member when OWNER role is absent', async () => {
      const fallbackCompanyId = 'company-no-owner';
      await companyRepo.save(
        new CompanyEntity({
          id: fallbackCompanyId,
          name: 'Fallback Co',
          taxId: '1122334455',
          verificationStatus: CompanyVerificationStatus.VERIFIED,
        }),
      );
      await memberRepo.create({
        companyId: fallbackCompanyId,
        userId: 'hr-user-1',
        role: CompanyMemberRole.HR_MANAGER,
        status: CompanyMemberStatus.ACTIVE,
      });

      const result = await adapter.describe(fallbackCompanyId);
      expect(result).toEqual({
        ownerUserId: 'hr-user-1',
        name: 'Fallback Co',
      });
    });
  });

  describe('suspend (AC-03, AC-04, AC-05)', () => {
    it('should throw NotFoundException if target company does not exist', async () => {
      await expect(
        adapter.suspend('non-existent', sanctionId, reason),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update company verificationStatus to REJECTED and record decision in verification history', async () => {
      await adapter.suspend(companyId, sanctionId, reason);

      const updatedCompany = await companyRepo.findById(companyId);
      expect(updatedCompany?.verificationStatus).toBe(
        CompanyVerificationStatus.REJECTED,
      );

      const latestVerif = await verificationRepo.findLatestByCompanyId(companyId);
      expect(latestVerif).toBeDefined();
      expect(latestVerif?.status).toBe(CompanyVerificationStatus.REJECTED);
      expect(latestVerif?.rejectionReason).toContain(sanctionId);
      expect(latestVerif?.rejectionReason).toContain(reason);
    });

    it('should transition active OPEN jobs to PAUSED and hiddenByModeration=true', async () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Active job of suspended company
      const activeJob = await jobRepo.create({
        companyId,
        branchId,
        title: 'Backend Node.js Intern',
        description: 'Internship position',
        industry: 'IT',
        type: JobType.INTERNSHIP,
        skills: ['Node.js'],
        quantity: 2,
        deadline: future,
        status: JobStatus.OPEN,
        hiddenByModeration: false,
      });

      // Draft / Pending approval job of suspended company (not open)
      const pendingJob = await jobRepo.create({
        companyId,
        branchId,
        title: 'Pending Job',
        description: 'Waiting review',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: ['React'],
        quantity: 1,
        deadline: future,
        status: JobStatus.PENDING_APPROVAL,
        hiddenByModeration: false,
      });

      // Closed job of suspended company
      const closedJob = await jobRepo.create({
        companyId,
        branchId,
        title: 'Closed Job',
        description: 'Finished',
        industry: 'IT',
        type: JobType.FULL_TIME,
        skills: ['Java'],
        quantity: 1,
        deadline: future,
        status: JobStatus.CLOSED,
        hiddenByModeration: false,
      });

      // Active job of OTHER company (must NOT be modified)
      const otherActiveJob = await jobRepo.create({
        companyId: otherCompanyId,
        branchId,
        title: 'Other Company Job',
        description: 'Other company position',
        industry: 'Sales',
        type: JobType.PART_TIME,
        skills: ['Communication'],
        quantity: 3,
        deadline: future,
        status: JobStatus.OPEN,
        hiddenByModeration: false,
      });

      await adapter.suspend(companyId, sanctionId, reason);

      // 1. Active job must now be PAUSED and hiddenByModeration = true
      const suspendedJob = await jobRepo.findById(activeJob.id);
      expect(suspendedJob?.status).toBe(JobStatus.PAUSED);
      expect(suspendedJob?.hiddenByModeration).toBe(true);
      expect(suspendedJob?.rejectionReason).toContain(sanctionId);

      // 2. Pending job remains PENDING_APPROVAL and hiddenByModeration = false
      const reloadedPending = await jobRepo.findById(pendingJob.id);
      expect(reloadedPending?.status).toBe(JobStatus.PENDING_APPROVAL);
      expect(reloadedPending?.hiddenByModeration).toBe(false);

      // 3. Closed job remains CLOSED
      const reloadedClosed = await jobRepo.findById(closedJob.id);
      expect(reloadedClosed?.status).toBe(JobStatus.CLOSED);
      expect(reloadedClosed?.hiddenByModeration).toBe(false);

      // 4. Other company's job must remain OPEN and untouched
      const reloadedOther = await jobRepo.findById(otherActiveJob.id);
      expect(reloadedOther?.status).toBe(JobStatus.OPEN);
      expect(reloadedOther?.hiddenByModeration).toBe(false);
    });

    it('should be idempotent when suspend is called repeatedly', async () => {
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const activeJob = await jobRepo.create({
        companyId,
        branchId,
        title: 'DevOps Intern',
        description: 'DevOps',
        industry: 'IT',
        type: JobType.INTERNSHIP,
        skills: ['Docker'],
        quantity: 1,
        deadline: future,
        status: JobStatus.OPEN,
      });

      // First call
      await adapter.suspend(companyId, sanctionId, reason);
      const firstCheck = await jobRepo.findById(activeJob.id);
      expect(firstCheck?.status).toBe(JobStatus.PAUSED);
      expect(firstCheck?.hiddenByModeration).toBe(true);

      // Second call (idempotent repeat)
      await expect(
        adapter.suspend(companyId, sanctionId, reason),
      ).resolves.not.toThrow();

      const secondCheck = await jobRepo.findById(activeJob.id);
      expect(secondCheck?.status).toBe(JobStatus.PAUSED);
      expect(secondCheck?.hiddenByModeration).toBe(true);
    });
  });

  describe('unsuspend (Lifting sanction & restoring state)', () => {
    it('should throw NotFoundException if company does not exist', async () => {
      await expect(
        adapter.unsuspend('non-existent', sanctionId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should restore company verificationStatus to VERIFIED', async () => {
      // First suspend
      await adapter.suspend(companyId, sanctionId, reason);
      const suspended = await companyRepo.findById(companyId);
      expect(suspended?.verificationStatus).toBe(
        CompanyVerificationStatus.REJECTED,
      );

      // Lift suspension
      await adapter.unsuspend(companyId, sanctionId);
      const restored = await companyRepo.findById(companyId);
      expect(restored?.verificationStatus).toBe(
        CompanyVerificationStatus.VERIFIED,
      );

      const latestVerif = await verificationRepo.findLatestByCompanyId(companyId);
      expect(latestVerif?.status).toBe(CompanyVerificationStatus.VERIFIED);
      expect(latestVerif?.rejectionReason).toBeNull();
    });

    it('should restore unexpired jobs to OPEN and unhide them', async () => {
      const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const activeJob = await jobRepo.create({
        companyId,
        branchId,
        title: 'Frontend Engineer',
        description: 'React developer',
        industry: 'IT',
        type: JobType.FULL_TIME,
        skills: ['React'],
        quantity: 1,
        deadline: future,
        status: JobStatus.OPEN,
      });

      // Suspend
      await adapter.suspend(companyId, sanctionId, reason);
      expect((await jobRepo.findById(activeJob.id))?.status).toBe(
        JobStatus.PAUSED,
      );

      // Unsuspend
      await adapter.unsuspend(companyId, sanctionId);

      const unhidden = await jobRepo.findById(activeJob.id);
      expect(unhidden?.status).toBe(JobStatus.OPEN);
      expect(unhidden?.hiddenByModeration).toBe(false);
      expect(unhidden?.rejectionReason).toBeNull();
    });

    it('should transition job to CLOSED if it expired during the suspension period', async () => {
      // Job with deadline in the past
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expiredJob = await jobRepo.create({
        companyId,
        branchId,
        title: 'Expired Intern',
        description: 'Expired position',
        industry: 'IT',
        type: JobType.INTERNSHIP,
        skills: ['Git'],
        quantity: 1,
        deadline: past,
        status: JobStatus.OPEN,
      });

      // Suspend
      await adapter.suspend(companyId, sanctionId, reason);

      // Unsuspend
      await adapter.unsuspend(companyId, sanctionId);

      // Because deadline < now, job must be CLOSED, not OPEN
      const closed = await jobRepo.findById(expiredJob.id);
      expect(closed?.status).toBe(JobStatus.CLOSED);
      expect(closed?.hiddenByModeration).toBe(false);
    });

    it('should NOT unhide or reopen jobs that were manually paused by employer', async () => {
      const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const manualPausedJob = await jobRepo.create({
        companyId,
        branchId,
        title: 'Manually Paused Job',
        description: 'Paused by employer earlier',
        industry: 'IT',
        type: JobType.FULL_TIME,
        skills: ['TypeScript'],
        quantity: 1,
        deadline: future,
        status: JobStatus.PAUSED,
        hiddenByModeration: false,
        rejectionReason: null,
      });

      // Suspend company
      await adapter.suspend(companyId, sanctionId, reason);

      // Unsuspend company
      await adapter.unsuspend(companyId, sanctionId);

      // The manually paused job must remain PAUSED and hiddenByModeration=false
      const check = await jobRepo.findById(manualPausedJob.id);
      expect(check?.status).toBe(JobStatus.PAUSED);
      expect(check?.hiddenByModeration).toBe(false);
    });
  });
});
