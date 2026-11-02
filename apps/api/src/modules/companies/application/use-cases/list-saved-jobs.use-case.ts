import { Inject, Injectable } from '@nestjs/common';
import { SavedJobListResponseDto } from '@campusjob/contracts';
import {
  ISavedJobRepository,
  SAVED_JOB_REPOSITORY_TOKEN,
} from '../../domain/repositories/saved-job.repository.interface';

@Injectable()
export class ListSavedJobsUseCase {
  constructor(
    @Inject(SAVED_JOB_REPOSITORY_TOKEN)
    private readonly savedJobRepo: ISavedJobRepository,
  ) {}

  async execute(
    studentId: string,
    query?: { page?: number; limit?: number },
  ): Promise<SavedJobListResponseDto> {
    const page = Math.max(1, query?.page ?? 1);
    const limit = Math.min(Math.max(1, query?.limit ?? 10), 50);

    const { items, total } = await this.savedJobRepo.findByStudentId(
      studentId,
      { page, limit },
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      savedJobs: items.map((item) =>
        item.savedJob.toItemDto({
          isAvailable: item.isAvailable,
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
