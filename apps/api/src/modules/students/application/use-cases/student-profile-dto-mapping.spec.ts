import { GetStudentProfileUseCase } from './get-student-profile.use-case';
import { UpdateStudentProfileUseCase } from './update-student-profile.use-case';
import { IStudentProfileRepository } from '../../domain/repositories/student-profile.repository.interface';
import { StudentProfileEntity } from '../../domain/entities/student-profile.entity';
import { JobSeekingStatus, StudentProfileDto } from '@campusjob/contracts';

describe('S4-M02-01: StudentProfile DTO Mapping & Field Synchronization (Unit)', () => {
  let mockRepository: jest.Mocked<IStudentProfileRepository>;
  let getUseCase: GetStudentProfileUseCase;
  let updateUseCase: UpdateStudentProfileUseCase;

  const mockDate = new Date('2026-11-05T00:00:00.000Z');

  const createSampleEntity = (overrides?: Partial<StudentProfileEntity>): StudentProfileEntity => {
    return new StudentProfileEntity(
      overrides?.id ?? 'profile-uuid-1',
      overrides?.userId ?? 'user-uuid-1',
      overrides?.fullName ?? 'Nguyễn Văn Sinh Viên',
      overrides?.email ?? 'student@example.com',
      overrides?.phone ?? '0901234567',
      overrides?.avatarUrl ?? null,
      overrides?.university ?? 'Đại học Bách Khoa',
      overrides?.major ?? 'Khoa học Máy tính',
      overrides?.graduationYear ?? 2026,
      overrides?.jobSeekingStatus ?? JobSeekingStatus.ACTIVELY_LOOKING,
      overrides?.bio ?? 'Sinh viên năm cuối ngành KHMT',
      overrides?.skills ?? ['TypeScript', 'NestJS', 'PostgreSQL'],
      overrides?.isCampusVerified ?? false,
      overrides?.campusEmail ?? null,
      overrides?.createdAt ?? mockDate,
      overrides?.updatedAt ?? mockDate,
    );
  };

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      createOrFind: jest.fn(),
      updateByUserId: jest.fn(),
    };

    getUseCase = new GetStudentProfileUseCase(mockRepository);
    updateUseCase = new UpdateStudentProfileUseCase(mockRepository);
  });

  describe('AC-01 & AC-02: GET Profile DTO Contract & Normalized Skill Mapping', () => {
    it('should return StudentProfileDto matching all 16 contract fields', async () => {
      const entity = createSampleEntity();
      mockRepository.createOrFind.mockResolvedValue(entity);

      const response = await getUseCase.execute('user-uuid-1');

      expect(mockRepository.createOrFind).toHaveBeenCalledWith('user-uuid-1');
      expect(response.profile).toBeDefined();

      const profile: StudentProfileDto = response.profile;
      expect(profile.id).toBe('profile-uuid-1');
      expect(profile.userId).toBe('user-uuid-1');
      expect(profile.fullName).toBe('Nguyễn Văn Sinh Viên');
      expect(profile.email).toBe('student@example.com');
      expect(profile.phone).toBe('0901234567');
      expect(profile.university).toBe('Đại học Bách Khoa');
      expect(profile.major).toBe('Khoa học Máy tính');
      expect(profile.graduationYear).toBe(2026);
      expect(profile.jobSeekingStatus).toBe(JobSeekingStatus.ACTIVELY_LOOKING);
      expect(profile.bio).toBe('Sinh viên năm cuối ngành KHMT');
      expect(profile.skills).toEqual(['TypeScript', 'NestJS', 'PostgreSQL']);
      expect(profile.createdAt).toBe(mockDate.toISOString());
      expect(profile.updatedAt).toBe(mockDate.toISOString());
    });

    it('should maintain safe defaults for non-persisted fields (avatarUrl: null, isCampusVerified: false, campusEmail: null)', async () => {
      const entity = createSampleEntity({
        avatarUrl: null,
        isCampusVerified: false,
        campusEmail: null,
      });
      mockRepository.createOrFind.mockResolvedValue(entity);

      const response = await getUseCase.execute('user-uuid-1');

      // Contract ADR-015: No fake data, safe defaults when not persisted
      expect(response.profile.avatarUrl).toBeNull();
      expect(response.profile.isCampusVerified).toBe(false);
      expect(response.profile.campusEmail).toBeNull();
    });

    it('should map empty skills array cleanly when entity has no skills', async () => {
      const entity = createSampleEntity({ skills: [] });
      mockRepository.createOrFind.mockResolvedValue(entity);

      const response = await getUseCase.execute('user-uuid-1');

      expect(Array.isArray(response.profile.skills)).toBe(true);
      expect(response.profile.skills).toHaveLength(0);
    });
  });

  describe('AC-03 & AC-04: UPDATE Profile without Arbitrary Relations & Safe Persistence', () => {
    it('should pass only domain update fields to repository and map updated DTO', async () => {
      const updatedEntity = createSampleEntity({
        university: 'Đại học Quốc tế',
        skills: ['React', 'Next.js'],
        jobSeekingStatus: JobSeekingStatus.OPEN_FOR_OPPORTUNITIES,
      });

      mockRepository.updateByUserId.mockResolvedValue(updatedEntity);

      const updateData = {
        university: 'Đại học Quốc tế',
        skills: ['React', 'Next.js'],
        jobSeekingStatus: JobSeekingStatus.OPEN_FOR_OPPORTUNITIES,
      };

      const response = await updateUseCase.execute('user-uuid-1', updateData);

      expect(mockRepository.updateByUserId).toHaveBeenCalledWith('user-uuid-1', updateData);
      expect(response.profile.university).toBe('Đại học Quốc tế');
      expect(response.profile.skills).toEqual(['React', 'Next.js']);
      expect(response.profile.jobSeekingStatus).toBe(JobSeekingStatus.OPEN_FOR_OPPORTUNITIES);
    });
  });
});
