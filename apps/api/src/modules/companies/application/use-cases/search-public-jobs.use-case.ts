import { Inject, Injectable } from '@nestjs/common';
import {
  PublicJobPostingListResponseDto,
} from '@campusjob/contracts';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';
import { PublicJobQueryDto } from '../dto/public-job-query.dto';

@Injectable()
export class SearchPublicJobsUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
  ) {}

  async execute(query: PublicJobQueryDto): Promise<PublicJobPostingListResponseDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 10), 50);
    const city = query.city || query.location;

    const { jobs, total } = await this.jobRepo.searchPublic({
      keyword: query.keyword,
      industry: query.industry,
      city,
      type: query.type,
      salaryMin: query.salaryMin,
      salaryMax: query.salaryMax,
      schedule: query.schedule,
      page,
      limit,
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      jobs: jobs.map((item) =>
        item.job.toPublicDto({
          companyName: item.companyName,
          companyLogoUrl: item.companyLogoUrl,
          branchCity: item.branchCity,
          branchName: item.branchName,
        }),
      ),
      total,
      page,
      limit,
      totalPages,
    };
  }
}
