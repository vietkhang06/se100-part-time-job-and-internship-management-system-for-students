import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { JobErrorCode, SaveJobResponseDto } from '@campusjob/contracts';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';
import {
  ISavedJobRepository,
  SAVED_JOB_REPOSITORY_TOKEN,
} from '../../domain/repositories/saved-job.repository.interface';

@Injectable()
export class SaveJobUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(SAVED_JOB_REPOSITORY_TOKEN)
    private readonly savedJobRepo: ISavedJobRepository,
  ) {}

  async execute(studentId: string, jobId: string): Promise<SaveJobResponseDto> {
    // S3-M03-03: Chỉ được lưu tin đủ điều kiện công khai (Shared Visibility Predicate)
    const publicJob = await this.jobRepo.findPublicById(jobId);
    if (!publicJob) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tin tuyển dụng không tồn tại hoặc không đủ điều kiện công khai để lưu.',
        error: 'Not Found',
        code: JobErrorCode.JOB_NOT_FOUND,
      });
    }

    // Idempotent: lưu lần 2 vẫn thành công không tạo duplicate row
    const saved = await this.savedJobRepo.save(studentId, jobId);

    return {
      message: 'Đã lưu tin tuyển dụng thành công.',
      saved: true,
      savedJobId: saved.id,
    };
  }
}
