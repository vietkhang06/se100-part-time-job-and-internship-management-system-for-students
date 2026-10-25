import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CvSnapshotDto,
  CvErrorCode,
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

/**
 * Contract C-03: Triển khai Use Case cấp phát Snapshot CV an toàn cho M04 Application
 * Phục vụ UC38 (Nộp hồ sơ ứng tuyển) và UC37 (Xem chi tiết hồ sơ ứng tuyển)
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
   * Thực thi trích xuất bản chụp CV
   */
  async execute(studentId: string, cvId: string): Promise<CvSnapshotDto> {
    // 1. Kiểm tra hồ sơ sinh viên tồn tại
    const profile = await this.profileRepo.findById(studentId);
    if (!profile) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy hồ sơ sinh viên.',
        error: 'Not Found',
        code: StudentProfileErrorCode.STUDENT_PROFILE_NOT_FOUND,
      });
    }

    // 2. Tra cứu CV theo cvId
    const cv = await this.cvRepo.findById(cvId);

    // 3. Quy tắc an ninh nghiêm ngặt (Anti-IDOR): CV phải tồn tại và thuộc về đúng sinh viên
    if (!cv || cv.studentProfileId !== profile.id) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy CV hoặc bạn không có quyền truy cập CV này.',
        error: 'Not Found',
        code: CvErrorCode.CV_NOT_FOUND,
      });
    }

    // 4. Đóng gói bản chụp snapshot CV bất biến
    const snapshot: CvSnapshotDto = {
      snapshotId: randomUUID(),
      originalCvId: cv.id,
      studentId: profile.id,
      fullName: profile.fullName || 'Sinh viên CampusJob',
      email: profile.email || '',
      phone: profile.phone || null,
      title: cv.title,
      summary: cv.summary ?? null,
      educations: cv.educations || [],
      experiences: cv.experiences || [],
      skills: cv.skills || [],
      projects: cv.projects || [],
      certifications: cv.certifications || [],
      fileUrl: cv.fileUrl ?? null,
      fileAssetId: cv.fileAssetId ?? null,
      capturedAt: new Date().toISOString(),
    };

    return snapshot;
  }
}
