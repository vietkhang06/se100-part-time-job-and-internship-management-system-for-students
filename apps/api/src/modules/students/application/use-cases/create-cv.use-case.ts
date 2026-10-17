import {
  Inject,
  Injectable,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { CvResponseDto, CvErrorCode } from '@campusjob/contracts';
import {
  ICvRepository,
  CV_REPOSITORY_TOKEN,
} from '../../domain/repositories/cv.repository.interface';
import {
  IStudentProfileRepository,
  STUDENT_PROFILE_REPOSITORY_TOKEN,
} from '../../domain/repositories/student-profile.repository.interface';
import { FileAssetService } from '../../../../shared/storage/file-asset.service';
import { CreateCvDto } from '../dto/create-cv.dto';

@Injectable()
export class CreateCvUseCase {
  constructor(
    @Inject(CV_REPOSITORY_TOKEN)
    private readonly cvRepo: ICvRepository,
    @Inject(STUDENT_PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IStudentProfileRepository,
    @Optional()
    private readonly fileAssetService?: FileAssetService,
  ) {}

  async execute(userId: string, dto: CreateCvDto): Promise<CvResponseDto> {
    const profile = await this.profileRepo.createOrFind(userId);

    // Xac thuc quyen so huu fileAsset neu client gui fileAssetId
    if (dto.fileAssetId && this.fileAssetService) {
      await this.fileAssetService.verifyOwnership(dto.fileAssetId, userId);
    }

    const count = await this.cvRepo.countByStudentProfileId(profile.id);
    if (count >= 10) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Mỗi sinh viên chỉ được tạo tối đa 10 CV. Vui lòng xóa bớt CV không sử dụng.',
        error: 'Bad Request',
        code: CvErrorCode.CV_LIMIT_EXCEEDED,
      });
    }

    // Default Invariant: Nếu là CV đầu tiên, tự động gán isDefault = true
    const isDefault = count === 0 ? true : (dto.isDefault ?? false);

    const created = await this.cvRepo.create({
      studentProfileId: profile.id,
      title: dto.title,
      summary: dto.summary,
      isDefault,
      fileUrl: dto.fileUrl,
      fileAssetId: dto.fileAssetId,
      skills: dto.skills ?? [],
      educations: dto.educations ?? [],
      experiences: dto.experiences ?? [],
      projects: dto.projects ?? [],
      certifications: dto.certifications ?? [],
    });

    return {
      message: 'Tạo CV mới thành công.',
      cv: {
        id: created.id,
        studentId: profile.id,
        userId: profile.userId,
        title: created.title,
        summary: created.summary,
        isDefault: created.isDefault,
        fileUrl: created.fileUrl,
        fileAssetId: created.fileAssetId ?? null,
        educations: created.educations,
        experiences: created.experiences,
        skills: created.skills,
        projects: created.projects,
        certifications: created.certifications,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    };
  }
}
