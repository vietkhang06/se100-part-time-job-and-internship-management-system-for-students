import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole, CvErrorCode } from '@campusjob/contracts';
import {
  ICvRepository,
  CV_REPOSITORY_TOKEN,
} from '../../domain/repositories/cv.repository.interface';
import {
  IStudentProfileRepository,
  STUDENT_PROFILE_REPOSITORY_TOKEN,
} from '../../domain/repositories/student-profile.repository.interface';
import { FileAssetService } from '../../../../shared/storage/file-asset.service';
import { PrismaService } from '../../../../shared/database/prisma.service';

export interface DownloadCvFileResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class DownloadCvFileUseCase {
  constructor(
    @Inject(CV_REPOSITORY_TOKEN)
    private readonly cvRepo: ICvRepository,
    @Inject(STUDENT_PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IStudentProfileRepository,
    private readonly fileAssetService: FileAssetService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    userId: string,
    cvId: string,
    userRole: UserRole = UserRole.STUDENT,
  ): Promise<DownloadCvFileResult> {
    // 1. Quản trị viên (ADMIN) & Kiểm duyệt viên (MODERATOR) có quyền xem tệp kiểm tra nội dung
    if (userRole === UserRole.ADMIN || userRole === UserRole.MODERATOR) {
      const cv = await this.cvRepo.findById(cvId);
      if (!cv || !cv.fileAssetId) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Không tìm thấy CV hoặc CV không có tệp tài liệu đính kèm.',
          error: 'Not Found',
          code: CvErrorCode.CV_NOT_FOUND,
        });
      }

      const file = await this.fileAssetService.getFile(cv.fileAssetId);
      const fileName =
        file.fileAsset.originalName ||
        `${cv.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

      return {
        buffer: file.buffer,
        fileName,
        mimeType: file.fileAsset.mimeType,
        sizeBytes: file.fileAsset.sizeBytes,
      };
    }

    // 2. Nhà tuyển dụng (EMPLOYER): Chỉ được phép tải nếu sinh viên đã nộp đơn ứng tuyển với CV này
    if (userRole === UserRole.EMPLOYER) {
      const cv = await this.cvRepo.findById(cvId);
      if (!cv || !cv.fileAssetId) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Không tìm thấy CV hoặc CV không có tệp tài liệu đính kèm.',
          error: 'Not Found',
          code: CvErrorCode.CV_NOT_FOUND,
        });
      }

      // Kiểm tra có hồ sơ ứng tuyển liên quan tới CV này hay không
      const application = await this.prisma.application.findFirst({
        where: { cvId },
      });

      if (!application) {
        throw new ForbiddenException({
          statusCode: 403,
          message:
            'Bạn không có quyền truy cập tệp CV này do chưa có hồ sơ ứng tuyển liên quan.',
          error: 'Forbidden',
        });
      }

      const file = await this.fileAssetService.getFile(cv.fileAssetId);
      const fileName =
        file.fileAsset.originalName ||
        `${cv.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

      return {
        buffer: file.buffer,
        fileName,
        mimeType: file.fileAsset.mimeType,
        sizeBytes: file.fileAsset.sizeBytes,
      };
    }

    // 3. Sinh viên (STUDENT): Chỉ chủ sở hữu CV mới được phép tải tệp của mình (Anti-IDOR)
    if (userRole === UserRole.STUDENT) {
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
        // Anti-IDOR: Không để lộ sự tồn tại của CV thuộc sở hữu sinh viên khác
        throw new NotFoundException({
          statusCode: 404,
          message: 'Không tìm thấy CV hoặc bạn không có quyền truy cập.',
          error: 'Not Found',
          code: CvErrorCode.CV_NOT_FOUND,
        });
      }

      if (!cv.fileAssetId) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'CV này không có tệp tài liệu đính kèm để tải xuống.',
          error: 'Not Found',
          code: CvErrorCode.CV_NOT_FOUND,
        });
      }

      // fileAssetService.getFile kiểm tra quyền sở hữu với userId
      const file = await this.fileAssetService.getFile(cv.fileAssetId, userId);
      const fileName =
        file.fileAsset.originalName ||
        `${cv.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

      return {
        buffer: file.buffer,
        fileName,
        mimeType: file.fileAsset.mimeType,
        sizeBytes: file.fileAsset.sizeBytes,
      };
    }

    throw new ForbiddenException({
      statusCode: 403,
      message: 'Bạn không có quyền truy cập tệp CV này.',
      error: 'Forbidden',
    });
  }
}
