import { Inject, Injectable } from '@nestjs/common';
import { CompanyMemberRole, CompanyMemberStatus } from '@campusjob/contracts';
import {
  ICompanyDirectory,
  ReviewCompanyInfo,
} from '../../../reviews/application/ports/review-sources.port';
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

/**
 * CompanyDirectoryAdapter
 *
 * Triển khai ICompanyDirectory cho ReviewsModule (M05 / C-18).
 * Giúp M05 tìm đúng thông tin doanh nghiệp sở hữu tin/doanh nghiệp của nhà tuyển dụng.
 */
@Injectable()
export class CompanyDirectoryAdapter implements ICompanyDirectory {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
  ) {}

  async findByJob(jobId: string): Promise<ReviewCompanyInfo | null> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) return null;

    const company = await this.companyRepo.findById(job.companyId);
    if (!company) return null;

    // Tìm chủ sở hữu (OWNER) hoặc đại diện doanh nghiệp
    const ownerUserId = await this.resolveOwnerUserId(company.id);
    return {
      companyId: company.id,
      companyName: company.name,
      ownerUserId,
    };
  }

  async findByEmployer(employerUserId: string): Promise<ReviewCompanyInfo | null> {
    const member = await this.memberRepo.findActiveByUserId(employerUserId);
    if (!member) return null;

    const company = await this.companyRepo.findById(member.companyId);
    if (!company) return null;

    const ownerUserId = await this.resolveOwnerUserId(company.id);
    return {
      companyId: company.id,
      companyName: company.name,
      ownerUserId,
    };
  }

  private async resolveOwnerUserId(companyId: string): Promise<string> {
    // Trả về userId của member OWNER nếu có, nếu không thì bất kỳ active member
    const members = await this.memberRepo.findAllByUserId(companyId);
    const owner = members.find(
      (m) => m.companyId === companyId && m.role === CompanyMemberRole.OWNER && m.status === CompanyMemberStatus.ACTIVE,
    );
    if (owner) return owner.userId;

    return companyId; // fallback an toàn
  }
}
