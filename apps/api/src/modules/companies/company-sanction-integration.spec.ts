import {
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyVerificationStatus,
  JobStatus,
  JobType,
  NotificationEventType,
  SanctionStatus,
  SanctionType,
  UserRole,
  ViolationReportStatus,
  ViolationTargetType,
} from '@campusjob/contracts';
import { M04WorkflowError } from '../applications/application/m04-ports';
import { ApplySanctionUseCase } from '../sanctions/application/use-cases/apply-sanction.use-case';
import { LiftSanctionUseCase } from '../sanctions/application/use-cases/lift-sanction.use-case';
import { CompanySanctionHandlerRegistry } from '../sanctions/application/ports/company-sanction-handler.port';
import { ISanctionRepository } from '../sanctions/domain/repositories/sanction.repository.interface';
import { SanctionEntity } from '../sanctions/domain/entities/sanction.entity';
import { IReportAdmin } from '../reports/application/ports/report-admin.port';
import { IUserRepository } from '../users/domain/repositories/user.repository.interface';
import { INotificationPublisher } from '../notifications/application/ports/notification-publisher.port';

import { CompanyEntity } from './domain/entities/company.entity';
import { CompanyBranchEntity } from './domain/entities/company-branch.entity';
import { CompanySanctionAdapter } from './infrastructure/adapters/company-sanction.adapter';
import { JobAccessSourceAdapter } from './infrastructure/adapters/job-access-source.adapter';
import { InMemoryCompanyRepository } from './infrastructure/persistence/in-memory-company.repository';
import { InMemoryCompanyVerificationRepository } from './infrastructure/persistence/in-memory-company-verification.repository';
import { InMemoryJobPostingRepository } from './infrastructure/persistence/in-memory-job-posting.repository';
import { InMemoryCompanyMemberRepository } from './infrastructure/persistence/in-memory-company-member.repository';
import { InMemoryCompanyBranchRepository } from './infrastructure/persistence/in-memory-company-branch.repository';

describe('S5-M05-02 — Company Approval Decision & Suspension Integration (Cross-Module)', () => {
  let companyRepo: InMemoryCompanyRepository;
  let verificationRepo: InMemoryCompanyVerificationRepository;
  let jobRepo: InMemoryJobPostingRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let branchRepo: InMemoryCompanyBranchRepository;

  let handlerRegistry: CompanySanctionHandlerRegistry;
  let companyAdapter: CompanySanctionAdapter;
  let jobAccessAdapter: JobAccessSourceAdapter;

  let applySanctionUseCase: ApplySanctionUseCase;
  let liftSanctionUseCase: LiftSanctionUseCase;

  // M05 Sanction Mocks
  let sanctionRepo: jest.Mocked<ISanctionRepository>;
  let reportAdmin: jest.Mocked<IReportAdmin>;
  let userRepo: jest.Mocked<IUserRepository>;
  let notificationPublisher: jest.Mocked<INotificationPublisher>;

  const companyId = 'company-vintech';
  const branchId = 'branch-hcm';
  const ownerUserId = 'user-owner-vt';
  const adminActor = { id: 'admin-super' };
  const reporterUserId = 'student-reporter';
  const reportId = 'report-123';
  const now = new Date();

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    verificationRepo = new InMemoryCompanyVerificationRepository();
    jobRepo = new InMemoryJobPostingRepository();
    memberRepo = new InMemoryCompanyMemberRepository();
    branchRepo = new InMemoryCompanyBranchRepository();

    handlerRegistry = new CompanySanctionHandlerRegistry();

    companyAdapter = new CompanySanctionAdapter(
      companyRepo,
      verificationRepo,
      jobRepo,
      memberRepo,
      handlerRegistry,
    );
    companyAdapter.onModuleInit();

    jobAccessAdapter = new JobAccessSourceAdapter(
      jobRepo,
      companyRepo,
      memberRepo,
      branchRepo,
    );

    // Mock Sanctions dependencies
    const sanctionsStore = new Map<string, SanctionEntity>();
    sanctionRepo = {
      create: jest.fn().mockImplementation(async (data) => {
        const entity = new SanctionEntity({
          id: data.id,
          reportId: data.reportId,
          targetType: data.targetType,
          targetId: data.targetId,
          type: data.type,
          reason: data.reason,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          storedStatus: SanctionStatus.ACTIVE,
          imposedBy: data.imposedBy,
          createdAt: now,
          liftedAt: null,
          liftReason: null,
        });
        sanctionsStore.set(data.id, entity);
        return { sanction: entity, duplicate: false };
      }),
      findById: jest.fn().mockImplementation(async (id) => {
        const found = sanctionsStore.get(id);
        return found ? { sanction: found, events: [] } : null;
      }),
      findActiveByTarget: jest.fn().mockResolvedValue(null),
      findLiftedReportIds: jest.fn().mockResolvedValue([]),
      lift: jest.fn().mockImplementation(async (id) => {
        const found = sanctionsStore.get(id);
        if (!found) return null;
        const lifted = new SanctionEntity({
          id: found.id,
          reportId: found.reportId,
          targetType: found.targetType,
          targetId: found.targetId,
          type: found.type,
          reason: found.reason,
          startsAt: found.startsAt,
          endsAt: found.endsAt,
          storedStatus: SanctionStatus.LIFTED,
          imposedBy: found.imposedBy,
          createdAt: found.createdAt,
          liftedAt: now,
          liftReason: 'Lifted',
        });
        sanctionsStore.set(id, lifted);
        return lifted;
      }),
      recordExpired: jest.fn(),
    } as any;

    reportAdmin = {
      findById: jest.fn().mockResolvedValue({
        id: reportId,
        reporterId: reporterUserId,
        targetType: ViolationTargetType.COMPANY,
        targetId: companyId,
        status: ViolationReportStatus.SUBSTANTIATED,
      }),
      markResolved: jest.fn().mockResolvedValue(true),
      listViolationReportIds: jest.fn().mockResolvedValue([]),
    } as any;

    userRepo = {
      findById: jest.fn().mockResolvedValue({
        id: ownerUserId,
        role: UserRole.EMPLOYER,
      }),
    } as any;

    notificationPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    applySanctionUseCase = new ApplySanctionUseCase(
      sanctionRepo,
      reportAdmin,
      userRepo,
      notificationPublisher,
      handlerRegistry,
    );

    liftSanctionUseCase = new LiftSanctionUseCase(
      sanctionRepo,
      handlerRegistry,
    );

    // Seed Verified Company
    await companyRepo.save(
      new CompanyEntity({
        id: companyId,
        name: 'VinTech Solutions',
        taxId: '0123456789',
        verificationStatus: CompanyVerificationStatus.VERIFIED,
      }),
    );

    // Seed Active Owner Member
    await memberRepo.create({
      companyId,
      userId: ownerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    // Seed Branch
    await branchRepo.save(
      new CompanyBranchEntity({
        id: branchId,
        companyId,
        branchName: 'Headquarters',
        addressLine: '123 Nguyen Hue',
        city: 'Ho Chi Minh',
        isHeadquarter: true,
      }),
    );
  });

  it('End-to-End: Admin applies COMPANY_SUSPENSION -> M03 updates company status -> hides active jobs -> blocks applications -> Admin lifts sanction -> restores company & jobs', async () => {
    const futureDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Create an OPEN job
    const job = await jobRepo.create({
      companyId,
      branchId,
      title: 'Fullstack TypeScript Intern',
      description: 'Develop NestJS and Next.js applications',
      industry: 'IT',
      type: JobType.INTERNSHIP,
      skills: ['TypeScript', 'NestJS'],
      quantity: 2,
      deadline: futureDeadline,
      status: JobStatus.OPEN,
      hiddenByModeration: false,
    });

    // Verify job is currently accepting applications via M04 port (JobAccessSource)
    await expect(
      jobAccessAdapter.assertAcceptingApplications(job.id),
    ).resolves.not.toThrow();

    // 1. Admin applies COMPANY_SUSPENSION via ApplySanctionUseCase
    const sanctionResult = await applySanctionUseCase.execute(
      adminActor,
      {
        reportId,
        type: SanctionType.COMPANY_SUSPENSION,
        reason: 'Có hành vi thu tiền đặt cọc trái phép của sinh viên',
      },
      now,
    );

    expect(sanctionResult).toBeDefined();
    expect(sanctionResult.type).toBe(SanctionType.COMPANY_SUSPENSION);

    // 2. Verify M03 Company Status is updated to REJECTED (no longer VERIFIED)
    const companyAfterSuspension = await companyRepo.findById(companyId);
    expect(companyAfterSuspension?.verificationStatus).toBe(
      CompanyVerificationStatus.REJECTED,
    );
    expect(companyAfterSuspension?.canPublishJob()).toBe(false);

    // 3. Verify Active Job is PAUSED and hiddenByModeration = true
    const jobAfterSuspension = await jobRepo.findById(job.id);
    expect(jobAfterSuspension?.status).toBe(JobStatus.PAUSED);
    expect(jobAfterSuspension?.hiddenByModeration).toBe(true);
    expect(jobAfterSuspension?.rejectionReason).toContain('COMPANY_SUSPENSION');

    // 4. Verify M04 JobAccessSource now rejects application attempts with INVALID_STATE
    await expect(
      jobAccessAdapter.assertAcceptingApplications(job.id),
    ).rejects.toThrow(M04WorkflowError);

    // 5. Verify notification was published to the company owner
    expect(notificationPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NotificationEventType.SANCTION_APPLIED,
        recipientId: ownerUserId,
      }),
    );

    // 6. Admin lifts the sanction via LiftSanctionUseCase
    await liftSanctionUseCase.execute(
      adminActor,
      sanctionResult.id,
      'Doanh nghiệp đã hoàn trả tiền và giải trình đầy đủ',
      now,
    );

    // 7. Verify M03 Company Status is restored to VERIFIED
    const companyAfterLift = await companyRepo.findById(companyId);
    expect(companyAfterLift?.verificationStatus).toBe(
      CompanyVerificationStatus.VERIFIED,
    );
    expect(companyAfterLift?.canPublishJob()).toBe(true);

    // 8. Verify Job is restored to OPEN and unhidden
    const jobAfterLift = await jobRepo.findById(job.id);
    expect(jobAfterLift?.status).toBe(JobStatus.OPEN);
    expect(jobAfterLift?.hiddenByModeration).toBe(false);
    expect(jobAfterLift?.rejectionReason).toBeNull();

    // 9. Verify M04 JobAccessSource accepts applications again
    await expect(
      jobAccessAdapter.assertAcceptingApplications(job.id),
    ).resolves.not.toThrow();
  });
});
