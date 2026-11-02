import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyErrorCode,
  JobPostingListResponseDto,
} from '@campusjob/contracts';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';
import {
  ICompanyMemberRepository,
  COMPANY_MEMBER_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-member.repository.interface';
import {
  ISavedJobRepository,
  SAVED_JOB_REPOSITORY_TOKEN,
} from '../../domain/repositories/saved-job.repository.interface';
import { JobPostingQueryDto } from '../dto/job-posting-query.dto';

@Injectable()
export class ListEmployerJobsUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
    @Inject(SAVED_JOB_REPOSITORY_TOKEN)
    private readonly savedJobRepo: ISavedJobRepository,
  ) {}

  async execute(
    userId: string,
    query: JobPostingQueryDto,
  ): Promise<JobPostingListResponseDto> {
    const membership = await this.memberRepo.findActiveByUserId(userId);
    if (!membership) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tài khoản chưa được liên kết với doanh nghiệp nào.',
        error: 'Not Found',
        code: CompanyErrorCode.EMPLOYER_HAS_NO_COMPANY,
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { jobs, total } = await this.jobRepo.findByCompanyId(
      membership.companyId,
      {
        status: query.status,
        page,
        limit,
      },
    );

    const jobIds = jobs.map((j) => j.id);
    const saveCounts = await this.savedJobRepo.countByJobIds(jobIds);

    return {
      jobs: jobs.map((j) =>
        j.toDto({ saveCount: saveCounts[j.id] ?? 0 }),
      ),
      total,
      page,
      limit,
    };
  }
}
