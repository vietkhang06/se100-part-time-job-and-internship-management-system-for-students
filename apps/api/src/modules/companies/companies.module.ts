import { MailModule } from '../../shared/mail/mail.module';
import { SavedJobsController } from './presentation/controllers/saved-jobs.controller';
import { AdminJobsController } from './presentation/controllers/admin-jobs.controller';
import { SaveJobUseCase } from './application/use-cases/save-job.use-case';
import { UnsaveJobUseCase } from './application/use-cases/unsave-job.use-case';
import { ListSavedJobsUseCase } from './application/use-cases/list-saved-jobs.use-case';
import { GetSavedJobIdsUseCase } from './application/use-cases/get-saved-job-ids.use-case';
import { GetAdminJobMetricsUseCase } from './application/use-cases/get-admin-job-metrics.use-case';
import { JobExpirySchedulerService } from './application/services/job-expiry-scheduler.service';
import { SAVED_JOB_REPOSITORY_TOKEN } from './domain/repositories/saved-job.repository.interface';
import { JOB_EXPIRY_REMINDER_LOG_REPOSITORY_TOKEN } from './domain/repositories/job-expiry-reminder-log.repository.interface';
import { JOB_EXPIRY_NOTIFIER_TOKEN } from './domain/ports/job-expiry-notifier.port';
import { PrismaSavedJobRepository } from './infrastructure/persistence/prisma-saved-job.repository';
import { PrismaJobExpiryReminderLogRepository } from './infrastructure/persistence/prisma-job-expiry-reminder-log.repository';
import { JobExpiryEmailNotifierAdapter } from './infrastructure/adapters/job-expiry-email-notifier.adapter';
import { Module, OnModuleInit, Optional } from '@nestjs/common';
import { ModerationTargetType } from '@campusjob/contracts';
import { DatabaseModule } from '../../shared/database/database.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ModerationTargetHandlerRegistry } from '../moderation/application/ports/moderation-target-handler.port';
import { ReviewSourcesRegistry } from '../reviews/application/ports/review-sources.port';

import { CompaniesController } from './presentation/controllers/companies.controller';
import { CompanyBranchesController } from './presentation/controllers/company-branches.controller';
import { JobsController } from './presentation/controllers/jobs.controller';
import { PublicJobsController } from './presentation/controllers/public-jobs.controller';
import { PublicCompaniesController } from './presentation/controllers/public-companies.controller';

import { GetCompanyProfileUseCase } from './application/use-cases/get-company-profile.use-case';
import { UpdateCompanyProfileUseCase } from './application/use-cases/update-company-profile.use-case';
import { CreateCompanyUseCase } from './application/use-cases/create-company.use-case';
import { VerifyCompanyUseCase } from './application/use-cases/verify-company.use-case';
import { ResubmitCompanyVerificationUseCase } from './application/use-cases/resubmit-company-verification.use-case';
import { GetCompanyVerificationHistoryUseCase } from './application/use-cases/get-company-verification-history.use-case';
import { SearchPublicCompaniesUseCase } from './application/use-cases/search-public-companies.use-case';
import { GetPublicCompanyDetailUseCase } from './application/use-cases/get-public-company-detail.use-case';

import { CreateBranchUseCase } from './application/use-cases/create-branch.use-case';
import { ListBranchesUseCase } from './application/use-cases/list-branches.use-case';
import { GetBranchDetailUseCase } from './application/use-cases/get-branch-detail.use-case';
import { UpdateBranchUseCase } from './application/use-cases/update-branch.use-case';
import { DeleteBranchUseCase } from './application/use-cases/delete-branch.use-case';

import { CreateJobPostingUseCase } from './application/use-cases/create-job-posting.use-case';
import { UpdateJobPostingUseCase } from './application/use-cases/update-job-posting.use-case';
import { ListEmployerJobsUseCase } from './application/use-cases/list-employer-jobs.use-case';
import { GetEmployerJobDetailUseCase } from './application/use-cases/get-employer-job-detail.use-case';
import { PauseJobPostingUseCase } from './application/use-cases/pause-job-posting.use-case';
import { ResumeJobPostingUseCase } from './application/use-cases/resume-job-posting.use-case';
import { CloseJobPostingUseCase } from './application/use-cases/close-job-posting.use-case';
import { SubmitJobPostingUseCase } from './application/use-cases/submit-job-posting.use-case';
import { JobModerationTargetHandler } from './application/use-cases/job-moderation-target.handler';
import { SearchPublicJobsUseCase } from './application/use-cases/search-public-jobs.use-case';
import { GetPublicJobDetailUseCase } from './application/use-cases/get-public-job-detail.use-case';

import { COMPANY_REPOSITORY_TOKEN } from './domain/repositories/company.repository.interface';
import { COMPANY_MEMBER_REPOSITORY_TOKEN } from './domain/repositories/company-member.repository.interface';
import { COMPANY_BRANCH_REPOSITORY_TOKEN } from './domain/repositories/company-branch.repository.interface';
import { COMPANY_VERIFICATION_REPOSITORY_TOKEN } from './domain/repositories/company-verification.repository.interface';
import { JOB_POSTING_REPOSITORY_TOKEN } from './domain/repositories/job-posting.repository.interface';
import { JOB_BRANCH_USAGE_CHECKER_TOKEN } from './domain/ports/job-branch-usage-checker.port';
import { JOB_MODERATION_QUEUE_PORT_TOKEN } from './domain/ports/job-moderation-queue.port';

import { PrismaCompanyRepository } from './infrastructure/persistence/prisma-company.repository';
import { PrismaCompanyMemberRepository } from './infrastructure/persistence/prisma-company-member.repository';
import { PrismaCompanyBranchRepository } from './infrastructure/persistence/prisma-company-branch.repository';
import { PrismaCompanyVerificationRepository } from './infrastructure/persistence/prisma-company-verification.repository';
import { PrismaJobPostingRepository } from './infrastructure/persistence/prisma-job-posting.repository';
import { ModerationQueueAdapter } from './infrastructure/adapters/moderation-queue.adapter';
import { JobAccessSourceAdapter } from './infrastructure/adapters/job-access-source.adapter';
import { CompanyDirectoryAdapter } from './infrastructure/adapters/company-directory.adapter';
import { M04_JOB_SOURCE } from '../applications/m04.module';

@Module({
  imports: [DatabaseModule, StorageModule, ModerationModule, MailModule],
  controllers: [
    CompaniesController,
    CompanyBranchesController,
    JobsController,
    PublicJobsController,
    PublicCompaniesController,
    SavedJobsController,
    AdminJobsController,
  ],
  providers: [
    GetCompanyProfileUseCase,
    UpdateCompanyProfileUseCase,
    CreateCompanyUseCase,
    VerifyCompanyUseCase,
    ResubmitCompanyVerificationUseCase,
    GetCompanyVerificationHistoryUseCase,
    SearchPublicCompaniesUseCase,
    GetPublicCompanyDetailUseCase,
    CreateBranchUseCase,
    ListBranchesUseCase,
    GetBranchDetailUseCase,
    UpdateBranchUseCase,
    DeleteBranchUseCase,
    CreateJobPostingUseCase,
    UpdateJobPostingUseCase,
    ListEmployerJobsUseCase,
    GetEmployerJobDetailUseCase,
    PauseJobPostingUseCase,
    ResumeJobPostingUseCase,
    CloseJobPostingUseCase,
    SubmitJobPostingUseCase,
    JobModerationTargetHandler,
    SearchPublicJobsUseCase,
    GetPublicJobDetailUseCase,
    JobAccessSourceAdapter,
    CompanyDirectoryAdapter,
    SaveJobUseCase,
    UnsaveJobUseCase,
    ListSavedJobsUseCase,
    GetSavedJobIdsUseCase,
    GetAdminJobMetricsUseCase,
    JobExpirySchedulerService,
    {
      provide: SAVED_JOB_REPOSITORY_TOKEN,
      useClass: PrismaSavedJobRepository,
    },
    {
      provide: JOB_EXPIRY_REMINDER_LOG_REPOSITORY_TOKEN,
      useClass: PrismaJobExpiryReminderLogRepository,
    },
    {
      provide: JOB_EXPIRY_NOTIFIER_TOKEN,
      useClass: JobExpiryEmailNotifierAdapter,
    },
    {
      provide: COMPANY_REPOSITORY_TOKEN,
      useClass: PrismaCompanyRepository,
    },
    {
      provide: COMPANY_MEMBER_REPOSITORY_TOKEN,
      useClass: PrismaCompanyMemberRepository,
    },
    {
      provide: COMPANY_BRANCH_REPOSITORY_TOKEN,
      useClass: PrismaCompanyBranchRepository,
    },
    {
      provide: COMPANY_VERIFICATION_REPOSITORY_TOKEN,
      useClass: PrismaCompanyVerificationRepository,
    },
    {
      provide: JOB_POSTING_REPOSITORY_TOKEN,
      useClass: PrismaJobPostingRepository,
    },
    {
      provide: JOB_BRANCH_USAGE_CHECKER_TOKEN,
      useExisting: JOB_POSTING_REPOSITORY_TOKEN,
    },
    {
      provide: JOB_MODERATION_QUEUE_PORT_TOKEN,
      useClass: ModerationQueueAdapter,
    },
    {
      provide: M04_JOB_SOURCE,
      useExisting: JobAccessSourceAdapter,
    },
  ],
  exports: [
    GetCompanyProfileUseCase,
    UpdateCompanyProfileUseCase,
    CreateCompanyUseCase,
    VerifyCompanyUseCase,
    ResubmitCompanyVerificationUseCase,
    GetCompanyVerificationHistoryUseCase,
    SearchPublicCompaniesUseCase,
    GetPublicCompanyDetailUseCase,
    CreateBranchUseCase,
    ListBranchesUseCase,
    GetBranchDetailUseCase,
    UpdateBranchUseCase,
    DeleteBranchUseCase,
    CreateJobPostingUseCase,
    UpdateJobPostingUseCase,
    ListEmployerJobsUseCase,
    GetEmployerJobDetailUseCase,
    PauseJobPostingUseCase,
    ResumeJobPostingUseCase,
    CloseJobPostingUseCase,
    SubmitJobPostingUseCase,
    JobModerationTargetHandler,
    SearchPublicJobsUseCase,
    GetPublicJobDetailUseCase,
    JobAccessSourceAdapter,
    CompanyDirectoryAdapter,
    M04_JOB_SOURCE,
    COMPANY_REPOSITORY_TOKEN,
    COMPANY_MEMBER_REPOSITORY_TOKEN,
    COMPANY_BRANCH_REPOSITORY_TOKEN,
    COMPANY_VERIFICATION_REPOSITORY_TOKEN,
    JOB_POSTING_REPOSITORY_TOKEN,
    JOB_BRANCH_USAGE_CHECKER_TOKEN,
    JOB_MODERATION_QUEUE_PORT_TOKEN,
    SaveJobUseCase,
    UnsaveJobUseCase,
    ListSavedJobsUseCase,
    GetSavedJobIdsUseCase,
    GetAdminJobMetricsUseCase,
    JobExpirySchedulerService,
    SAVED_JOB_REPOSITORY_TOKEN,
    JOB_EXPIRY_REMINDER_LOG_REPOSITORY_TOKEN,
    JOB_EXPIRY_NOTIFIER_TOKEN,
  ],
})
export class CompaniesModule implements OnModuleInit {
  constructor(
    @Optional()
    private readonly handlerRegistry?: ModerationTargetHandlerRegistry,
    @Optional()
    private readonly jobHandler?: JobModerationTargetHandler,
    @Optional()
    private readonly reviewSourcesRegistry?: ReviewSourcesRegistry,
    @Optional()
    private readonly companyDirectoryAdapter?: CompanyDirectoryAdapter,
  ) {}

  onModuleInit() {
    if (this.handlerRegistry && this.jobHandler) {
      this.handlerRegistry.register(ModerationTargetType.JOB, this.jobHandler);
    }
    if (this.reviewSourcesRegistry && this.companyDirectoryAdapter) {
      this.reviewSourcesRegistry.registerCompanyDirectory(
        this.companyDirectoryAdapter,
      );
    }
  }
}
