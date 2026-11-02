import { Inject, Injectable } from '@nestjs/common';
import { SaveJobResponseDto } from '@campusjob/contracts';
import {
  ISavedJobRepository,
  SAVED_JOB_REPOSITORY_TOKEN,
} from '../../domain/repositories/saved-job.repository.interface';

@Injectable()
export class UnsaveJobUseCase {
  constructor(
    @Inject(SAVED_JOB_REPOSITORY_TOKEN)
    private readonly savedJobRepo: ISavedJobRepository,
  ) {}

  async execute(studentId: string, jobId: string): Promise<SaveJobResponseDto> {
    // S3-M03-03: Bỏ lưu chỉ tác động đến liên kết của người dùng hiện tại
    // Idempotent: bỏ lưu tin chưa lưu vẫn trả về thành công
    await this.savedJobRepo.unsave(studentId, jobId);

    return {
      message: 'Đã bỏ lưu tin tuyển dụng thành công.',
      saved: false,
    };
  }
}
