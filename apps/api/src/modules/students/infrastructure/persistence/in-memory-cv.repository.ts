import { Injectable } from '@nestjs/common';
import { ICvRepository } from '../../domain/repositories/cv.repository.interface';
import { CvEntity } from '../../domain/entities/cv.entity';

/**
 * In-memory CV Repository hỗ trợ kiểm thử và tích hợp Contract-First song song
 */
@Injectable()
export class InMemoryCvRepository implements ICvRepository {
  private readonly store: Map<string, CvEntity> = new Map();

  constructor() {
    this.seedDefaults();
  }

  seedDefaults(): void {
    // 1. CV mẫu để sinh viên test thử nghiệm UC38
    this.store.set(
      'cv-sample-test',
      new CvEntity(
        'cv-sample-test',
        'default-student-profile',
        'default-user-id',
        'CV Lập trình viên Backend NestJS (Mẫu thử nghiệm UC38)',
        'Đam mê phát triển microservices và kiến trúc phần mềm sạch',
        true,
        'https://storage.campusjob.vn/cvs/sample-backend.pdf',
        ['NestJS', 'TypeScript', 'PostgreSQL', 'Docker'],
        [
          {
            school: 'Đại học Bách Khoa TP.HCM',
            major: 'Khoa học Máy tính',
            startDate: '2021-09',
            endDate: '2025-06',
            gpa: '3.6/4.0',
          },
        ],
        [
          {
            company: 'FPT Software',
            position: 'Backend Intern',
            startDate: '2024-06',
            endDate: '2024-12',
            description: 'Xây dựng API dịch vụ tuyển dụng',
          },
        ],
        [
          {
            name: 'CampusJob System',
            role: 'Backend Developer',
            startDate: '2024-01',
            endDate: '2024-05',
            description: 'Hệ thống việc làm thêm sinh viên',
          },
        ],
        [],
        new Date('2026-02-01'),
        new Date('2026-02-15'),
      ),
    );

    // 2. CV của sinh viên khác (Dùng để kiểm thử bảo mật Anti-IDOR)
    this.store.set(
      'cv-alien-forbidden',
      new CvEntity(
        'cv-alien-forbidden',
        'other-stranger-student-profile-id',
        'stranger-user-id',
        'CV của người khác (Bảo mật Anti-IDOR)',
        'Hồ sơ bảo mật của sinh viên khác',
        false,
        null,
        ['Python', 'Machine Learning'],
        [],
        [],
        [],
        [],
        new Date('2026-03-01'),
        new Date('2026-03-01'),
      ),
    );
  }

  ensureSampleForProfile(profileId: string): void {
    const existing = this.store.get('cv-sample-test');
    if (existing) {
      this.store.set(
        'cv-sample-test',
        new CvEntity(
          existing.id,
          profileId,
          existing.userId,
          existing.title,
          existing.summary,
          existing.isDefault,
          existing.fileUrl,
          existing.skills,
          existing.educations,
          existing.experiences,
          existing.projects,
          existing.certifications,
          existing.createdAt,
          existing.updatedAt,
          existing.fileAssetId ?? null,
        ),
      );
    }
  }

  async findById(id: string): Promise<CvEntity | null> {
    return this.store.get(id) ?? null;
  }

  async findByStudentProfileId(studentProfileId: string): Promise<CvEntity[]> {
    return Array.from(this.store.values()).filter(
      (cv) => cv.studentProfileId === studentProfileId,
    );
  }

  async countByStudentProfileId(studentProfileId: string): Promise<number> {
    return (await this.findByStudentProfileId(studentProfileId)).length;
  }

  async create(data: any): Promise<CvEntity> {
    const cv = new CvEntity(
      `cv-${Date.now()}`,
      data.studentProfileId,
      'user-id',
      data.title,
      data.summary,
      data.isDefault ?? false,
      data.fileUrl,
      data.skills ?? [],
      data.educations ?? [],
      data.experiences ?? [],
      data.projects ?? [],
      data.certifications ?? [],
      new Date(),
      new Date(),
      data.fileAssetId ?? null,
    );
    this.store.set(cv.id, cv);
    return cv;
  }

  async update(id: string, data: any): Promise<CvEntity> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('CV not found');
    const updated = new CvEntity(
      existing.id,
      existing.studentProfileId,
      existing.userId,
      data.title ?? existing.title,
      data.summary ?? existing.summary,
      data.isDefault ?? existing.isDefault,
      data.fileUrl ?? existing.fileUrl,
      data.skills ?? existing.skills,
      data.educations ?? existing.educations,
      data.experiences ?? existing.experiences,
      data.projects ?? existing.projects,
      data.certifications ?? existing.certifications,
      existing.createdAt,
      new Date(),
      data.fileAssetId !== undefined ? data.fileAssetId : (existing.fileAssetId ?? null),
    );
    this.store.set(id, updated);
    return updated;
  }

  async setDefault(studentProfileId: string, cvId: string): Promise<void> {
    for (const [id, cv] of this.store.entries()) {
      if (cv.studentProfileId === studentProfileId) {
        this.store.set(
          id,
          new CvEntity(
            cv.id,
            cv.studentProfileId,
            cv.userId,
            cv.title,
            cv.summary,
            cv.id === cvId,
            cv.fileUrl,
            cv.skills,
            cv.educations,
            cv.experiences,
            cv.projects,
            cv.certifications,
            cv.createdAt,
            cv.updatedAt,
            cv.fileAssetId ?? null,
          ),
        );
      }
    }
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async findDefaultByStudentProfileId(studentProfileId: string): Promise<CvEntity | null> {
    return (
      Array.from(this.store.values()).find(
        (cv) => cv.studentProfileId === studentProfileId && cv.isDefault,
      ) ?? null
    );
  }

  async findLatestByStudentProfileId(
    studentProfileId: string,
    excludeId?: string,
  ): Promise<CvEntity | null> {
    const list = Array.from(this.store.values())
      .filter((cv) => cv.studentProfileId === studentProfileId && cv.id !== excludeId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return list[0] ?? null;
  }

  async isCvInUse(_cvId: string): Promise<boolean> {
    return false;
  }

  save(cv: CvEntity): void {
    this.store.set(cv.id, cv);
  }

  clear(): void {
    this.store.clear();
  }
}
