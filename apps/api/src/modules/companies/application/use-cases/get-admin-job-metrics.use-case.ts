import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AdminJobMetricsResponseDto,
  JobErrorCode,
  JobMetricsDto,
} from '@campusjob/contracts';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';

@Injectable()
export class GetAdminJobMetricsUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
  ) {}

  async executeAggregate(): Promise<AdminJobMetricsResponseDto> {
    return this.jobRepo.getAdminJobMetrics();
  }

  async executeSingle(jobId: string): Promise<JobMetricsDto> {
    const metrics = await this.jobRepo.getSingleJobMetrics(jobId);
    if (!metrics) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy tin tuyển dụng.',
        error: 'Not Found',
        code: JobErrorCode.JOB_NOT_FOUND,
      });
    }
    return metrics;
  }
}
