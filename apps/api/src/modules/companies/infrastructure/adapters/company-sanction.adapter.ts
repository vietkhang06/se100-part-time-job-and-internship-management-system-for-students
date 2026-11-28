import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
  forwardRef,
} from '@nestjs/common';
import {
  CompanyErrorCode,
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyVerificationStatus,
  JobStatus,
} from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  CompanySanctionHandlerRegistry,
  ICompanySanctionHandler,
  SanctionedCompanyInfo,
} from '../../../sanctions/application/ports/company-sanction-handler.port';
import {
  COMPANY_REPOSITORY_TOKEN,
  ICompanyRepository,
} from '../../domain/repositories/company.repository.interface';
import {
  COMPANY_MEMBER_REPOSITORY_TOKEN,
  ICompanyMemberRepository,
} from '../../domain/repositories/company-member.repository.interface';
import {
  COMPANY_VERIFICATION_REPOSITORY_TOKEN,
  ICompanyVerificationRepository,
} from '../../domain/repositories/company-verification.repository.interface';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';

/**
 * CompanySanctionAdapter (S5-M05-02 / C-06, C-08, C-19)
 *
 * Triển khai ICompanySanctionHandler từ M05:
 * - Cung cấp thông tin doanh nghiệp (describe) để gửi thông báo chế tài cho chủ sở hữu
 * - Đình chỉ doanh nghiệp (suspend): chuyển trạng thái xác thực sang REJECTED, ghi nhận quyết định,
 *   và ẩn/ngừng công khai các tin tuyển dụng đang hoạt động (OPEN -> PAUSED, hiddenByModeration=true)
 * - Gỡ đình chỉ doanh nghiệp (unsuspend): khôi phục trạng thái xác thực sang VERIFIED và
 *   gỡ cờ ẩn cho các tin tuyển dụng còn hạn nộp hồ sơ
 * - Đảm bảo tính idempotent theo sanctionId
 */
@Injectable()
export class CompanySanctionAdapter
  implements ICompanySanctionHandler, OnModuleInit
{
  private readonly logger = new Logger(CompanySanctionAdapter.name);

  constructor(
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
    @Inject(COMPANY_VERIFICATION_REPOSITORY_TOKEN)
    private readonly verificationRepo: ICompanyVerificationRepository,
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
    @Optional()
    @Inject(forwardRef(() => CompanySanctionHandlerRegistry))
    private readonly registry?: CompanySanctionHandlerRegistry,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  onModuleInit() {
    if (this.registry) {
      this.registry.register(this);
      this.logger.log(
        'CompanySanctionAdapter registered into CompanySanctionHandlerRegistry',
      );
    }
  }

  async describe(companyId: string): Promise<SanctionedCompanyInfo | null> {
    const company = await this.companyRepo.findById(companyId);
    if (!company) {
      return null;
    }

    const ownerUserId = await this.resolveOwnerUserId(company.id);
    return {
      ownerUserId,
      name: company.name,
    };
  }

  async suspend(
    companyId: string,
    sanctionId: string,
    reason: string,
  ): Promise<void> {
    const company = await this.companyRepo.findById(companyId);
    if (!company) {
      throw new NotFoundException({
        statusCode: 404,
        message: `Không tìm thấy doanh nghiệp ID: ${companyId}`,
        error: 'Not Found',
        code: CompanyErrorCode.COMPANY_NOT_FOUND,
      });
    }

    this.logger.log(
      `Applying suspension on company ${companyId} (sanctionId: ${sanctionId})`,
    );

    // 1. Cập nhật trạng thái xác thực doanh nghiệp
    // Chuyển sang REJECTED để doanh nghiệp không còn VERIFIED, ngăn công khai tin tuyển dụng
    if (company.verificationStatus !== CompanyVerificationStatus.REJECTED) {
      company.setVerificationStatus(CompanyVerificationStatus.REJECTED);
      await this.companyRepo.save(company);
    }

    // 2. Ghi nhận quyết định đình chỉ vào lịch sử xác thực doanh nghiệp
    const reasonTag = `[COMPANY_SUSPENSION:${sanctionId}] ${reason}`;
    const latestVerification =
      await this.verificationRepo.findLatestByCompanyId(companyId);
    if (latestVerification) {
      await this.verificationRepo.recordDecision({
        verificationId: latestVerification.id,
        reviewerId: 'system:sanction',
        status: CompanyVerificationStatus.REJECTED,
        rejectionReason: reasonTag,
      });
    } else {
      const created = await this.verificationRepo.createVerification({
        companyId: company.id,
        status: CompanyVerificationStatus.REJECTED,
      });
      await this.verificationRepo.recordDecision({
        verificationId: created.id,
        reviewerId: 'system:sanction',
        status: CompanyVerificationStatus.REJECTED,
        rejectionReason: reasonTag,
      });
    }

    // 3. Xử lý các tin tuyển dụng đang hoạt động (OPEN) của doanh nghiệp:
    // Chuyển OPEN -> PAUSED kèm hiddenByModeration = true để ẩn khỏi tìm kiếm công khai
    // và ngăn nhận hồ sơ ứng tuyển theo Shared Visibility Predicate
    let page = 1;
    const limit = 100;
    let hasMore = true;
    while (hasMore) {
      const { jobs, total } = await this.jobRepo.findByCompanyId(companyId, {
        status: JobStatus.OPEN,
        page,
        limit,
      });

      for (const job of jobs) {
        if (job.status === JobStatus.OPEN) {
          await this.jobRepo.update(job.id, {
            status: JobStatus.PAUSED,
            hiddenByModeration: true,
            rejectionReason: reasonTag,
          });
          this.logger.log(
            `Job ${job.id} of company ${companyId} suspended (moved to PAUSED, hiddenByModeration=true)`,
          );
        }
      }

      if (page * limit >= total || jobs.length === 0) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // 4. Ghi AuditLog nếu có PrismaService
    if (this.prisma) {
      try {
        await this.prisma.auditLog.create({
          data: {
            action: 'COMPANY_SUSPENDED',
            entityType: 'Company',
            entityId: companyId,
            metadata: {
              sanctionId,
              reason,
            },
          },
        });
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to record audit log for company suspension: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  async unsuspend(companyId: string, sanctionId: string): Promise<void> {
    const company = await this.companyRepo.findById(companyId);
    if (!company) {
      throw new NotFoundException({
        statusCode: 404,
        message: `Không tìm thấy doanh nghiệp ID: ${companyId}`,
        error: 'Not Found',
        code: CompanyErrorCode.COMPANY_NOT_FOUND,
      });
    }

    this.logger.log(
      `Lifting suspension on company ${companyId} (sanctionId: ${sanctionId})`,
    );

    // 1. Khôi phục trạng thái xác thực của doanh nghiệp
    if (company.verificationStatus === CompanyVerificationStatus.REJECTED) {
      company.setVerificationStatus(CompanyVerificationStatus.VERIFIED);
      await this.companyRepo.save(company);

      const latestVerification =
        await this.verificationRepo.findLatestByCompanyId(companyId);
      if (latestVerification) {
        await this.verificationRepo.recordDecision({
          verificationId: latestVerification.id,
          reviewerId: 'system:sanction',
          status: CompanyVerificationStatus.VERIFIED,
          rejectionReason: null,
        });
      }
      this.logger.log(`Company ${companyId} restored to VERIFIED`);
    }

    // 2. Khôi phục các tin tuyển dụng đã bị đình chỉ bởi sanction này
    const reasonTagPrefix = `[COMPANY_SUSPENSION:${sanctionId}]`;
    let page = 1;
    const limit = 100;
    let hasMore = true;
    while (hasMore) {
      const { jobs, total } = await this.jobRepo.findByCompanyId(companyId, {
        status: JobStatus.PAUSED,
        page,
        limit,
      });

      for (const job of jobs) {
        if (
          job.hiddenByModeration &&
          job.rejectionReason?.includes(reasonTagPrefix)
        ) {
          const isExpired = job.isExpired();
          await this.jobRepo.update(job.id, {
            status: isExpired ? JobStatus.CLOSED : JobStatus.OPEN,
            hiddenByModeration: false,
            rejectionReason: null,
          });
          this.logger.log(
            `Job ${job.id} of company ${companyId} unhidden (new status: ${isExpired ? 'CLOSED (expired)' : 'OPEN'})`,
          );
        }
      }

      if (page * limit >= total || jobs.length === 0) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // 3. Ghi AuditLog nếu có PrismaService
    if (this.prisma) {
      try {
        await this.prisma.auditLog.create({
          data: {
            action: 'COMPANY_UNSUSPENDED',
            entityType: 'Company',
            entityId: companyId,
            metadata: {
              sanctionId,
            },
          },
        });
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to record audit log for company unsuspension: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async resolveOwnerUserId(companyId: string): Promise<string> {
    const members =
      await this.memberRepo.findActiveMembersByCompanyId(companyId);
    const owner = members.find(
      ({ member }) =>
        member.role === CompanyMemberRole.OWNER &&
        member.status === CompanyMemberStatus.ACTIVE,
    );
    if (owner) return owner.member.userId;

    if (members.length > 0 && members[0]?.member?.userId) {
      return members[0].member.userId;
    }

    return companyId;
  }
}

export { CompanySanctionAdapter as CompanySanctionHandler };
