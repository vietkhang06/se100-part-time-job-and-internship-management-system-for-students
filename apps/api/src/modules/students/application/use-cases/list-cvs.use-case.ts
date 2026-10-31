import { Inject, Injectable } from '@nestjs/common';
import { CvListResponseDto } from '@campusjob/contracts';
import {
  ICvRepository,
  CV_REPOSITORY_TOKEN,
} from '../../domain/repositories/cv.repository.interface';
import {
  IStudentProfileRepository,
  STUDENT_PROFILE_REPOSITORY_TOKEN,
} from '../../domain/repositories/student-profile.repository.interface';

@Injectable()
export class ListCvsUseCase {
  constructor(
    @Inject(CV_REPOSITORY_TOKEN)
    private readonly cvRepo: ICvRepository,
    @Inject(STUDENT_PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IStudentProfileRepository,
  ) {}

  async execute(userId: string): Promise<CvListResponseDto> {
    const profile = await this.profileRepo.createOrFind(userId);
    const cvs = await this.cvRepo.findByStudentProfileId(profile.id);

    return {
      data: cvs.map((cv) => ({
        id: cv.id,
        title: cv.title,
        isDefault: cv.isDefault,
        fileUrl: cv.fileUrl,
        fileAssetId: cv.fileAssetId ?? null,
        skills: cv.skills,
        createdAt: cv.createdAt.toISOString(),
        updatedAt: cv.updatedAt.toISOString(),
      })),
      total: cvs.length,
    };
  }
}
