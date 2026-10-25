import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  JobErrorCode,
  PublicJobPostingResponseDto,
} from '@campusjob/contracts';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';

@Injectable()
export class GetPublicJobDetailUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
  ) {}

  async execute(id: string): Promise<PublicJobPostingResponseDto> {
    const result = await this.jobRepo.findPublicById(id);

    if (!result) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tin tuyển dụng không tồn tại hoặc chưa công khai.',
        error: 'Not Found',
        code: JobErrorCode.JOB_NOT_FOUND,
      });
    }

    return {
      job: result.job.toPublicDto({
        companyName: result.companyName,
        companyLogoUrl: result.companyLogoUrl,
        branchCity: result.branchCity,
        branchName: result.branchName,
      }),
    };
  }
}
