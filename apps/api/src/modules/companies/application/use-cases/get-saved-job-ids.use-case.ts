import { Inject, Injectable } from '@nestjs/common';
import { SavedJobIdsResponseDto } from '@campusjob/contracts';
import {
  ISavedJobRepository,
  SAVED_JOB_REPOSITORY_TOKEN,
} from '../../domain/repositories/saved-job.repository.interface';

@Injectable()
export class GetSavedJobIdsUseCase {
  constructor(
    @Inject(SAVED_JOB_REPOSITORY_TOKEN)
    private readonly savedJobRepo: ISavedJobRepository,
  ) {}

  async execute(studentId: string): Promise<SavedJobIdsResponseDto> {
    const jobIds = await this.savedJobRepo.findSavedJobIds(studentId);
    return { jobIds };
  }
}
