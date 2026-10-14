import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SetDefaultCvResponseDto, CvErrorCode } from '@campusjob/contracts';
import {
  ICvRepository,
  CV_REPOSITORY_TOKEN,
} from '../../domain/repositories/cv.repository.interface';
import {
  IStudentProfileRepository,
  STUDENT_PROFILE_REPOSITORY_TOKEN,
} from '../../domain/repositories/student-profile.repository.interface';

@Injectable()
export class SetDefaultCvUseCase {
  constructor(
    @Inject(CV_REPOSITORY_TOKEN)
    private readonly cvRepo: ICvRepository,
    @Inject(STUDENT_PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IStudentProfileRepository,
  ) {}

  async execute(
    userId: string,
    cvId: string,
  ): Promise<SetDefaultCvResponseDto> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy CV hoặc bạn không có quyền truy cập.',
        error: 'Not Found',
        code: CvErrorCode.CV_NOT_FOUND,
      });
    }

    const cv = await this.cvRepo.findById(cvId);
    if (!cv || cv.studentProfileId !== profile.id) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy CV hoặc bạn không có quyền truy cập.',
        error: 'Not Found',
        code: CvErrorCode.CV_NOT_FOUND,
      });
    }

    await this.cvRepo.setDefault(profile.id, cvId);

    return {
      message: 'Đã đặt làm CV mặc định thành công.',
      cvId,
      isDefault: true,
    };
  }
}
