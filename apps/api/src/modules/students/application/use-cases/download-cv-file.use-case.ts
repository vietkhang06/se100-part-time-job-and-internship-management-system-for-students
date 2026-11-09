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

  private extractSnapshotMeta(cvSnapshot: unknown): {
    fileAssetId: string | null;
    title: string | null;
  } {
    if (!cvSnapshot || typeof cvSnapshot !== 'object' || Array.isArray(cvSnapshot)) {
      return { fileAssetId: null, title: null };
    }
    const record = cvSnapshot as Record<string, unknown>;
    const fileAssetId =
      typeof record.fileAssetId === 'string' && record.fileAssetId.trim().length > 0
        ? record.fileAssetId.trim()
        : null;
    const title =
      typeof record.title === 'string' && record.title.trim().length > 0
        ? record.title.trim()
        : null;
    return { fileAssetId, title };
  }

  async execute(
    userId: string,
    cvId: string,
    userRole: UserRole = UserRole.STUDENT,
  ): Promise<DownloadCvFileResult> {
    // 1. Quản trị viên (ADMIN) & Kiểm duyệt viên (MODERATOR) có quyền xem tệp kiểm tra nội dung
    if (userRole === UserRole.ADMIN || userRole === UserRole.MODERATOR) {
      const cv = await this.cvRepo.findById(cvId);
      let targetFileAssetId = cv?.fileAssetId ?? null;
      let fallbackTitle = cv?.title ?? 'cv';

      if (!targetFileAssetId && this.prisma.application?.findFirst) {
        const appWithCv = await this.prisma.application.findFirst({
          where: { cvId },
          orderBy: { createdAt: 'desc' },
        });
        const snap = this.extractSnapshotMeta(appWithCv?.cvSnapshot);
        if (snap.fileAssetId) {
          targetFileAssetId = snap.fileAssetId;
          if (snap.title) fallbackTitle = snap.title;
        }
      }

      if (!targetFileAssetId) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Không tìm thấy CV hoặc CV không có tệp tài liệu đính kèm.',
          error: 'Not Found',
          code: CvErrorCode.CV_NOT_FOUND,
        });
      }

      const file = await this.fileAssetService.getFile(targetFileAssetId);
      const fileName =
        file.fileAsset.originalName ||
        `${fallbackTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

      return {
        buffer: file.buffer,
        fileName,
        mimeType: file.fileAsset.mimeType,
        sizeBytes: file.fileAsset.sizeBytes,
      };
    }

    // 2. Nhà tuyển dụng (EMPLOYER - Contract C-04 & C-03):
    // Chỉ được phép tải nếu sinh viên đã nộp đơn ứng tuyển với CV này vào tin tuyển dụng thuộc công ty của Employer.
    // Ưu tiên lấy fileAssetId từ cvSnapshot bất biến để bảo toàn tham chiếu ngay cả khi sinh viên cập nhật/xóa CV gốc sau đó.
    if (userRole === UserRole.EMPLOYER) {
      const cv = await this.cvRepo.findById(cvId);

      const managedJobs = await this.prisma.jobPosting.findMany({
        where: {
          company: {
            members: {
              some: {
                userId,
                status: 'ACTIVE',
              },
            },
          },
        },
        select: { id: true },
      });
      const managedJobIds = managedJobs.map((j) => j.id);

      const application =
        managedJobIds.length > 0
          ? await this.prisma.application.findFirst({
              where: {
                cvId,
                jobId: { in: managedJobIds },
              },
              orderBy: { createdAt: 'desc' },
            })
          : null;

      const snap = this.extractSnapshotMeta(application?.cvSnapshot);
      const targetFileAssetId = snap.fileAssetId ?? cv?.fileAssetId ?? null;
      const fallbackTitle = snap.title ?? cv?.title ?? 'cv';

      if (!cv && !application) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Không tìm thấy CV hoặc CV không có tệp tài liệu đính kèm.',
          error: 'Not Found',
          code: CvErrorCode.CV_NOT_FOUND,
        });
      }

      if (!application) {
        throw new ForbiddenException({
          statusCode: 403,
          message:
            'Bạn không có quyền truy cập tệp CV này do chưa có hồ sơ ứng tuyển liên quan.',
          error: 'Forbidden',
          code: 'FORBIDDEN',
        });
      }

      if (!targetFileAssetId) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Không tìm thấy CV hoặc CV không có tệp tài liệu đính kèm.',
          error: 'Not Found',
          code: CvErrorCode.CV_NOT_FOUND,
        });
      }

      const file = await this.fileAssetService.getFile(targetFileAssetId);
      const fileName =
        file.fileAsset.originalName ||
        `${fallbackTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

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
      if (cv && cv.studentProfileId !== profile.id) {
        // Anti-IDOR: Không để lộ sự tồn tại của CV thuộc sở hữu sinh viên khác
        throw new NotFoundException({
          statusCode: 404,
          message: 'Không tìm thấy CV hoặc bạn không có quyền truy cập.',
          error: 'Not Found',
          code: CvErrorCode.CV_NOT_FOUND,
        });
      }

      let targetFileAssetId = cv?.fileAssetId ?? null;
      let fallbackTitle = cv?.title ?? 'cv';

      // Nếu CV gốc đã bị xóa sau khi đơn ứng tuyển kết thúc, cho phép sinh viên chính chủ tải lại từ snapshot đơn của mình
      if (!targetFileAssetId && !cv && this.prisma.application?.findFirst) {
        const ownApp = await this.prisma.application.findFirst({
          where: {
            cvId,
            studentId: { in: [userId, profile.id] },
          },
          orderBy: { createdAt: 'desc' },
        });
        const snap = this.extractSnapshotMeta(ownApp?.cvSnapshot);
        if (snap.fileAssetId) {
          targetFileAssetId = snap.fileAssetId;
          if (snap.title) fallbackTitle = snap.title;
        }
      }

      if (!cv && !targetFileAssetId) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Không tìm thấy CV hoặc bạn không có quyền truy cập.',
          error: 'Not Found',
          code: CvErrorCode.CV_NOT_FOUND,
        });
      }

      if (!targetFileAssetId) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'CV này không có tệp tài liệu đính kèm để tải xuống.',
          error: 'Not Found',
          code: CvErrorCode.CV_NOT_FOUND,
        });
      }

      // fileAssetService.getFile kiểm tra quyền sở hữu với userId
      const file = await this.fileAssetService.getFile(targetFileAssetId, userId);
      const fileName =
        file.fileAsset.originalName ||
        `${fallbackTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

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
