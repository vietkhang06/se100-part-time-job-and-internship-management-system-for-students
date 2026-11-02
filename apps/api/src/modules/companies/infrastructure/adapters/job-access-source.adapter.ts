import { Inject, Injectable } from '@nestjs/common';
import {
  CompanyMemberStatus,
  CompanyVerificationStatus,
  JobApplicationEligibilityDto,
  JobStatus,
} from '@campusjob/contracts';
import {
  JobAccessSource,
  M04WorkflowError,
} from '../../../applications/application/m04-ports';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';
import {
  ICompanyRepository,
  COMPANY_REPOSITORY_TOKEN,
} from '../../domain/repositories/company.repository.interface';
import {
  ICompanyMemberRepository,
  COMPANY_MEMBER_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-member.repository.interface';
import {
  ICompanyBranchRepository,
  COMPANY_BRANCH_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-branch.repository.interface';

/**
 * JobAccessSourceAdapter
 *
 * S2-M03-06 / S5-M03-02 (Contract C-07)
 * Triển khai adapter C-07 kết nối giữa M03 và M04:
 * - M04 kiểm tra điều kiện ứng tuyển (assertAcceptingApplications)
 * - M04 kiểm tra quyền quản lý tin của nhà tuyển dụng (assertManagedBy)
 * - Cung cấp getEligibility trả snapshot chuẩn hóa dữ liệu tin
 *
 * Quy tắc khả dụng (Shared Visibility Predicate):
 * - status === OPEN
 * - deadline > now (tự động đóng CLOSED nếu hết hạn)
 * - company.verificationStatus === VERIFIED
 * - branch thuộc đúng company
 * - hiddenByModeration === false
 */
@Injectable()
export class JobAccessSourceAdapter implements JobAccessSource {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
    @Inject(COMPANY_BRANCH_REPOSITORY_TOKEN)
    private readonly branchRepo: ICompanyBranchRepository,
  ) {}

  async assertAcceptingApplications(jobId: string): Promise<void> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      throw new M04WorkflowError('NOT_FOUND');
    }

    const now = new Date();
    // Tự động đóng tin hết hạn theo quy tắc Session 2
    if (job.deadline.getTime() <= now.getTime()) {
      if (job.status !== JobStatus.CLOSED) {
        await this.jobRepo.update(job.id, { status: JobStatus.CLOSED });
      }
      throw new M04WorkflowError('INVALID_STATE');
    }

    if (job.status !== JobStatus.OPEN) {
      throw new M04WorkflowError('INVALID_STATE');
    }

    if (job.hiddenByModeration) {
      throw new M04WorkflowError('INVALID_STATE');
    }

    const company = await this.companyRepo.findById(job.companyId);
    if (!company || company.verificationStatus !== CompanyVerificationStatus.VERIFIED) {
      throw new M04WorkflowError('INVALID_STATE');
    }

    const branch = await this.branchRepo.findById(job.branchId);
    if (!branch || branch.companyId !== job.companyId) {
      throw new M04WorkflowError('INVALID_STATE');
    }
  }

  async assertManagedBy(jobId: string, employerUserId: string): Promise<void> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      throw new M04WorkflowError('NOT_FOUND');
    }

    const member = await this.memberRepo.findByCompanyAndUser(
      job.companyId,
      employerUserId,
    );
    if (!member || member.status !== CompanyMemberStatus.ACTIVE) {
      throw new M04WorkflowError('FORBIDDEN');
    }
  }

  /**
   * S2-M03-06: Chuẩn hóa dữ liệu tin tuyển dụng cho M04 kiểm tra và hiển thị
   */
  async getEligibility(jobId: string): Promise<JobApplicationEligibilityDto> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      throw new M04WorkflowError('NOT_FOUND');
    }

    const company = await this.companyRepo.findById(job.companyId);
    const branch = await this.branchRepo.findById(job.branchId);

    const now = new Date();
    const isExpired = job.deadline.getTime() <= now.getTime();
    if (isExpired && job.status !== JobStatus.CLOSED) {
      await this.jobRepo.update(job.id, { status: JobStatus.CLOSED });
    }

    const isCompanyActive = company?.verificationStatus === CompanyVerificationStatus.VERIFIED;
    const isBranchValid = branch?.companyId === job.companyId;
    const acceptingApplications =
      job.status === JobStatus.OPEN &&
      !isExpired &&
      !job.hiddenByModeration &&
      isCompanyActive &&
      isBranchValid;

    return {
      jobId: job.id,
      companyId: job.companyId,
      companyName: company?.name ?? 'Unknown Company',
      branchId: job.branchId,
      title: job.title,
      status: isExpired ? JobStatus.CLOSED : job.status,
      deadline: job.deadline.toISOString(),
      quantity: job.quantity,
      acceptingApplications,
    };
  }
}
