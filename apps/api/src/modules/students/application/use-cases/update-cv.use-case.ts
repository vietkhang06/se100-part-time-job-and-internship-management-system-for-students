import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
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
import { UpdateCvDto } from '../dto/update-cv.dto';

@Injectable()
export class UpdateCvUseCase {
  constructor(
    @Inject(CV_REPOSITORY_TOKEN)
    private readonly cvRepo: ICvRepository,
    @Inject(STUDENT_PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IStudentProfileRepository,
  ) {}

  async execute(
    userId: string,
    cvId: string,
    dto: UpdateCvDto,
  ): Promise<CvResponseDto> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy CV hoặc bạn không có quyền truy cập.',
        error: 'Not Found',
        code: CvErrorCode.CV_NOT_FOUND,
      });
    }

    const existingCv = await this.cvRepo.findById(cvId);
    if (!existingCv || existingCv.studentProfileId !== profile.id) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy CV hoặc bạn không có quyền truy cập.',
        error: 'Not Found',
        code: CvErrorCode.CV_NOT_FOUND,
      });
    }

    // Default Invariant: Nếu là CV mặc định duy nhất, cấm hủy cờ isDefault: false
    if (dto.isDefault === false && existingCv.isDefault) {
      const totalCount = await this.cvRepo.countByStudentProfileId(profile.id);
      if (totalCount === 1) {
        throw new BadRequestException({
          statusCode: 400,
          message:
            'Hệ thống yêu cầu phải luôn có một CV mặc định. Vui lòng chọn một CV khác làm mặc định thay thế.',
          error: 'Bad Request',
          code: CvErrorCode.CANNOT_UNSET_ONLY_DEFAULT_CV,
        });
      }
    }

    const updated = await this.cvRepo.update(cvId, {
      title: dto.title,
      summary: dto.summary,
      isDefault: dto.isDefault,
      fileUrl: dto.fileUrl,
      skills: dto.skills,
      educations: dto.educations,
      experiences: dto.experiences,
      projects: dto.projects,
      certifications: dto.certifications,
    });

    return {
      message: 'Cập nhật CV thành công.',
      cv: {
        id: updated.id,
        studentId: profile.id,
        userId: profile.userId,
        title: updated.title,
        summary: updated.summary,
        isDefault: updated.isDefault,
        fileUrl: updated.fileUrl,
        educations: updated.educations,
        experiences: updated.experiences,
        skills: updated.skills,
        projects: updated.projects,
        certifications: updated.certifications,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  }
}
