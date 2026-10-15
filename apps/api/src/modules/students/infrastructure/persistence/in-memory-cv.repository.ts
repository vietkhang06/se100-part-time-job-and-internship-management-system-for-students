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

  save(cv: CvEntity): void {
    this.store.set(cv.id, cv);
  }

  clear(): void {
    this.store.clear();
  }
}

