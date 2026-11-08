import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CertificationItemDto,
  CvSnapshotDto,
  CvErrorCode,
  EducationItemDto,
  ExperienceItemDto,
  ProjectItemDto,
  StudentProfileErrorCode,
  CvSnapshotSource,
} from '@campusjob/contracts';
import { randomUUID } from 'crypto';
import {
  IStudentProfileRepository,
  STUDENT_PROFILE_REPOSITORY_TOKEN,
} from '../../domain/repositories/student-profile.repository.interface';
import {
  ICvRepository,
  CV_REPOSITORY_TOKEN,
} from '../../domain/repositories/cv.repository.interface';

function cloneAndFreezeItems<T extends object>(items: readonly T[] | undefined | null): T[] {
  if (!items || items.length === 0) {
    return Object.freeze([]) as unknown as T[];
  }
  const cloned = items.map((item) => Object.freeze({ ...item }));
  return Object.freeze(cloned) as unknown as T[];
}

/**
 * Contract C-03 & C-05 (S4-M02-03):
 * Triển khai Use Case cấp phát Snapshot CV bất biến và xác thực quyền sở hữu cho M04 Application.
 * Phục vụ UC38 (Nộp hồ sơ ứng tuyển) và UC37 (Xem chi tiết hồ sơ ứng tuyển).
 * Tuyệt đối không truy xuất nội bộ DB của M04.
 */
@Injectable()
export class GetCvSnapshotUseCase implements CvSnapshotSource {
  constructor(
    @Inject(STUDENT_PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IStudentProfileRepository,
    @Inject(CV_REPOSITORY_TOKEN)
    private readonly cvRepo: ICvRepository,
  ) {}

  /**
   * Cung cấp cổng tích hợp chuẩn Contract C-03 cho Module M04
   */
  async getOwnedSnapshot(
    studentId: string,
    cvId: string,
  ): Promise<CvSnapshotDto> {
    return this.execute(studentId, cvId);
  }

  /**
   * Thực thi trích xuất bản chụp CV bất biến thuộc đúng sinh viên sở hữu
   */
  async execute(studentId: string, cvId: string): Promise<CvSnapshotDto> {
    const normalizedStudentId = typeof studentId === 'string' ? studentId.trim() : '';
    const normalizedCvId = typeof cvId === 'string' ? cvId.trim() : '';

    if (!normalizedStudentId || !normalizedCvId) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Định danh sinh viên và mã CV không được để trống.',
        error: 'Bad Request',
        code: CvErrorCode.VALIDATION_ERROR,
      });
    }

    // 1. C-01 / C-05 truyền User.id đã xác thực; phân giải sang StudentProfile sở hữu
    const profile = await this.profileRepo.findByUserId(normalizedStudentId);
    if (!profile) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy hồ sơ sinh viên.',
        error: 'Not Found',
        code: StudentProfileErrorCode.STUDENT_PROFILE_NOT_FOUND,
      });
    }

    // 2. Tra cứu CV theo cvId từ kho lưu trữ M02
    const cv = await this.cvRepo.findById(normalizedCvId);

    // 3. Quy tắc an ninh nghiêm ngặt (Anti-IDOR - Contract C-05):
    // CV phải tồn tại và thuộc về đúng StudentProfile (và User) của sinh viên đang yêu cầu
    if (
      !cv ||
      cv.studentProfileId !== profile.id ||
      (Boolean(cv.userId) && cv.userId !== profile.userId)
    ) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy CV hoặc bạn không có quyền truy cập CV này.',
        error: 'Not Found',
        code: CvErrorCode.CV_NOT_FOUND,
      });
    }

    // 4. Kiểm tra tính toàn vẹn tối thiểu của CV nguồn (Contract C-03 §4.2)
    if (!cv.title || !cv.title.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'CV thiếu tiêu đề hoặc thông tin tối thiểu để nộp hồ sơ ứng tuyển.',
        error: 'Bad Request',
        code: CvErrorCode.VALIDATION_ERROR,
      });
    }

    // 5. Đóng gói bản chụp snapshot CV bất biến (Deep Clone + Deep Freeze đầy đủ 16 trường theo C-03)
    const snapshot: CvSnapshotDto = {
      snapshotId: randomUUID(),
      originalCvId: cv.id,
      studentId: profile.userId,
      fullName: profile.fullName?.trim() || 'Sinh viên CampusJob',
      email: profile.email?.trim() || '',
      phone: profile.phone ?? null,
      title: cv.title.trim(),
      summary: cv.summary ?? null,
      educations: cloneAndFreezeItems<EducationItemDto>(cv.educations),
      experiences: cloneAndFreezeItems<ExperienceItemDto>(cv.experiences),
      skills: Object.freeze([...(cv.skills ?? [])]) as unknown as string[],
      projects: cloneAndFreezeItems<ProjectItemDto>(cv.projects),
      certifications: cloneAndFreezeItems<CertificationItemDto>(cv.certifications),
      fileUrl: cv.fileUrl ?? null,
      fileAssetId: cv.fileAssetId ?? null,
      capturedAt: new Date().toISOString(),
    };

    return Object.freeze(snapshot);
  }
}
