import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  Optional,
  Logger,
} from '@nestjs/common';
import { DeleteCvResponseDto, CvErrorCode } from '@campusjob/contracts';
import {
  ICvRepository,
  CV_REPOSITORY_TOKEN,
} from '../../domain/repositories/cv.repository.interface';
import {
  IStudentProfileRepository,
  STUDENT_PROFILE_REPOSITORY_TOKEN,
} from '../../domain/repositories/student-profile.repository.interface';
import { FileAssetService } from '../../../../shared/storage/file-asset.service';

@Injectable()
export class DeleteCvUseCase {
  private readonly logger = new Logger(DeleteCvUseCase.name);

  constructor(
    @Inject(CV_REPOSITORY_TOKEN)
    private readonly cvRepo: ICvRepository,
    @Inject(STUDENT_PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IStudentProfileRepository,
    @Optional()
    private readonly fileAssetService?: FileAssetService,
  ) {}

  async execute(userId: string, cvId: string): Promise<DeleteCvResponseDto> {
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

    // Tiêu chí nghiệm thu 3: Từ chối xóa nếu CV đang được sử dụng trong hồ sơ ứng tuyển hoạt động
    const inUse = await this.cvRepo.isCvInUse(cvId);
    if (inUse) {
      throw new ConflictException({
        statusCode: 409,
        message:
          'Không thể xóa CV đang được sử dụng trong hồ sơ ứng tuyển đang hoạt động.',
        error: 'Conflict',
        code: CvErrorCode.CV_IN_USE_CANNOT_DELETE,
      });
    }

    // Tiêu chí nghiệm thu 2: Bảo toàn invariant nếu xóa CV mặc định
    if (cv.isDefault) {
      const fallbackCv = await this.cvRepo.findLatestByStudentProfileId(
        profile.id,
        cvId,
      );
      if (fallbackCv) {
        await this.cvRepo.setDefault(profile.id, fallbackCv.id);
      }
    }

    await this.cvRepo.delete(cvId);

    // Xóa an toàn FileAsset tương ứng nếu CV có liên kết
    if (cv.fileAssetId && this.fileAssetService) {
      try {
        await this.fileAssetService.deleteFileAsset(cv.fileAssetId, userId);
      } catch (err: any) {
        this.logger.warn(
          `Could not delete FileAsset [${cv.fileAssetId}] safely: ${err.message}`,
        );
      }
    }

    return {
      message: 'Xóa CV thành công.',
      deletedCvId: cvId,
    };
  }
}
