import { NotFoundException } from '@nestjs/common';
import {
  CvErrorCode,
  StudentProfileErrorCode,
  JobSeekingStatus,
} from '@campusjob/contracts';
import { GetCvSnapshotUseCase } from './get-cv-snapshot.use-case';
import { CvSnapshotSourceAdapter } from '../../infrastructure/adapters/cv-snapshot-source.adapter';
import { StudentProfileEntity } from '../../domain/entities/student-profile.entity';
import { CvEntity } from '../../domain/entities/cv.entity';
import { IStudentProfileRepository } from '../../domain/repositories/student-profile.repository.interface';
import { InMemoryCvRepository } from '../../infrastructure/persistence/in-memory-cv.repository';

describe('GetCvSnapshotUseCase – Contract C-03 (UC37–UC38)', () => {
  let useCase: GetCvSnapshotUseCase;
  let adapter: CvSnapshotSourceAdapter;
  let mockProfileRepo: jest.Mocked<IStudentProfileRepository>;
  let cvRepo: InMemoryCvRepository;

  const studentA = new StudentProfileEntity(
    'student-profile-id-1',
    'user-id-1',
    'Nguyễn Văn A',
    'nguyenvana@gmail.com',
    '0901234567',
    null,
    'Đại học Bách Khoa TP.HCM',
    'Khoa học Máy tính',
    2025,
    JobSeekingStatus.ACTIVELY_LOOKING,
    'Mục tiêu trở thành kỹ sư Backend',
    ['NodeJS', 'TypeScript', 'PostgreSQL'],
    true,
    'a.nguyen@hcmut.edu.vn',
    new Date('2026-01-01'),
    new Date('2026-01-01'),
  );

  const studentB = new StudentProfileEntity(
    'student-profile-id-2',
    'user-id-2',
    'Trần Thị B',
    'tranthib@gmail.com',
    '0987654321',
    null,
    'Đại học Khoa học Tự nhiên',
    'Hệ thống thông tin',
    2025,
    JobSeekingStatus.ACTIVELY_LOOKING,
    'Mục tiêu phát triển Frontend',
    ['React', 'Vue', 'TailwindCSS'],
    true,
    'b.tran@hcmus.edu.vn',
    new Date('2026-01-01'),
    new Date('2026-01-01'),
  );

  const cvOfStudentA = new CvEntity(
    'cv-id-100',
    'student-profile-id-1',
    'CV Lập trình viên Backend NestJS',
    'Có đam mê với kiến trúc hệ thống và microservices',
    true,
    'https://storage.campusjob.vn/cvs/cv100.pdf',
    ['NestJS', 'TypeScript', 'Docker', 'Redis'],
    [
      {
        school: 'Đại học Bách Khoa TP.HCM',
        major: 'Khoa học Máy tính',
        startDate: '2021-09',
        endDate: '2025-06',
        gpa: '3.7',
      },
    ],
    [
      {
        company: 'FPT Software',
        position: 'Backend Intern',
        startDate: '2024-06',
        endDate: '2024-12',
        description: 'Phát triển REST APIs bằng NestJS',
      },
    ],
    [
      {
        name: 'Dự án Thương mại điện tử',
        role: 'Backend Lead',
        startDate: '2024-01',
        endDate: '2024-05',
        description: 'Xây dựng dịch vụ thanh toán và giỏ hàng',
      },
    ],
    [
      {
        name: 'AWS Certified Cloud Practitioner',
        issuer: 'Amazon Web Services',
        issueDate: '2024-08',
      },
    ],
    new Date('2026-02-01'),
    new Date('2026-02-15'),
  );

  const cvOfStudentB = new CvEntity(
    'cv-id-200',
    'student-profile-id-2',
    'CV Chuyên viên UI/UX Frontend',
    'Thiết kế giao diện đẹp và tối ưu UX',
    true,
    null,
    ['Figma', 'React', 'Next.js'],
    [],
    [],
    [],
    [],
    new Date('2026-03-01'),
    new Date('2026-03-01'),
  );

  beforeEach(() => {
    mockProfileRepo = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      createOrFind: jest.fn(),
      updateByUserId: jest.fn(),
    };

    cvRepo = new InMemoryCvRepository();
    cvRepo.save(cvOfStudentA);
    cvRepo.save(cvOfStudentB);

    useCase = new GetCvSnapshotUseCase(mockProfileRepo, cvRepo);
    adapter = new CvSnapshotSourceAdapter(useCase);
  });

  describe('Tiêu chí nghiệm thu 1: M04 nhận đúng CV của sinh viên (UC38 Happy Path)', () => {
    it('phải trích xuất đầy đủ thông tin snapshot CV của sinh viên khi studentId và cvId hợp lệ', async () => {
      mockProfileRepo.findById.mockResolvedValue(studentA);

      const snapshot = await useCase.execute(studentA.id, cvOfStudentA.id);

      // Xác minh định danh và liên kết
      expect(snapshot).toBeDefined();
      expect(snapshot.snapshotId).toBeDefined();
      expect(typeof snapshot.snapshotId).toBe('string');
      expect(snapshot.originalCvId).toBe(cvOfStudentA.id);
      expect(snapshot.studentId).toBe(studentA.id);

      // Xác minh thông tin liên hệ được lấy chính xác từ tài khoản sinh viên
      expect(snapshot.fullName).toBe('Nguyễn Văn A');
      expect(snapshot.email).toBe('nguyenvana@gmail.com');
      expect(snapshot.phone).toBe('0901234567');

      // Xác minh thông tin chuyên môn của CV
      expect(snapshot.title).toBe('CV Lập trình viên Backend NestJS');
      expect(snapshot.summary).toBe('Có đam mê với kiến trúc hệ thống và microservices');
      expect(snapshot.skills).toEqual(['NestJS', 'TypeScript', 'Docker', 'Redis']);
      expect(snapshot.fileUrl).toBe('https://storage.campusjob.vn/cvs/cv100.pdf');

      // Xác minh học vấn, kinh nghiệm, dự án, chứng chỉ
      expect(snapshot.educations).toHaveLength(1);
      expect(snapshot.educations[0].school).toBe('Đại học Bách Khoa TP.HCM');
      expect(snapshot.experiences).toHaveLength(1);
      expect(snapshot.experiences[0].company).toBe('FPT Software');
      expect(snapshot.projects).toHaveLength(1);
      expect(snapshot.projects[0].name).toBe('Dự án Thương mại điện tử');
      expect(snapshot.certifications).toHaveLength(1);
      expect(snapshot.certifications[0].name).toBe('AWS Certified Cloud Practitioner');

      // Xác minh dấu thời gian snapshot
      expect(snapshot.capturedAt).toBeDefined();
      expect(new Date(snapshot.capturedAt).getTime()).not.toBeNaN();
    });

    it('CvSnapshotSourceAdapter phải chuyển tiếp thành công đến use case khi M04 gọi', async () => {
      mockProfileRepo.findById.mockResolvedValue(studentA);

      const snapshot = await adapter.getOwnedSnapshot(studentA.id, cvOfStudentA.id);

      expect(snapshot).toBeDefined();
      expect(snapshot.studentId).toBe(studentA.id);
      expect(snapshot.originalCvId).toBe(cvOfStudentA.id);
    });
  });

  describe('Tiêu chí nghiệm thu 2: Không truy cập CV người khác (Anti-IDOR Security)', () => {
    it('phải từ chối và ném lỗi 404 CV_NOT_FOUND khi sinh viên A cố tình nộp cvId của sinh viên B', async () => {
      // Giả sử sinh viên A đang đăng nhập (student-profile-id-1)
      mockProfileRepo.findById.mockResolvedValue(studentA);

      // Nhưng cố tình truyền cv-id-200 (thuộc về sinh viên B: student-profile-id-2)
      await expect(
        useCase.execute(studentA.id, cvOfStudentB.id),
      ).rejects.toThrow(NotFoundException);

      try {
        await useCase.execute(studentA.id, cvOfStudentB.id);
      } catch (error: any) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.statusCode).toBe(404);
        expect(error.response.code).toBe(CvErrorCode.CV_NOT_FOUND);
        expect(error.response.message).toContain('Không tìm thấy CV hoặc bạn không có quyền truy cập');
      }
    });

    it('phải từ chối và ném lỗi 404 khi cvId không hề tồn tại trên hệ thống', async () => {
      mockProfileRepo.findById.mockResolvedValue(studentA);

      await expect(
        useCase.execute(studentA.id, 'non-existent-cv-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('phải từ chối và ném lỗi 404 STUDENT_PROFILE_NOT_FOUND khi studentId không tồn tại', async () => {
      mockProfileRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute('invalid-student-id', cvOfStudentA.id),
      ).rejects.toThrow(NotFoundException);

      try {
        await useCase.execute('invalid-student-id', cvOfStudentA.id);
      } catch (error: any) {
        expect(error.response.code).toBe(StudentProfileErrorCode.STUDENT_PROFILE_NOT_FOUND);
      }
    });
  });

  describe('Tiêu chí nghiệm thu 3: Không làm thay đổi CV đã dùng trong hồ sơ (Snapshot Immutability - UC37)', () => {
    it('bản chụp snapshot phải giữ nguyên giá trị ban đầu ngay cả khi CV gốc bị sửa đổi', async () => {
      mockProfileRepo.findById.mockResolvedValue(studentA);

      // 1. Chụp snapshot tại thời điểm nộp đơn (UC38)
      const snapshotInitial = await useCase.execute(studentA.id, cvOfStudentA.id);
      expect(snapshotInitial.title).toBe('CV Lập trình viên Backend NestJS');
      expect(snapshotInitial.skills).toContain('NestJS');

      // 2. Sau đó, sinh viên vào sửa đổi CV gốc trên M02 (UC34)
      const modifiedCv = new CvEntity(
        cvOfStudentA.id,
        cvOfStudentA.studentProfileId,
        'CV AI Engineer (Đã đổi ngành)',
        'Mục tiêu chuyển sang nghiên cứu Trí tuệ nhân tạo',
        true,
        null,
        ['PyTorch', 'TensorFlow', 'Python'],
        [],
        [],
        [],
        [],
        cvOfStudentA.createdAt,
        new Date('2026-05-01'),
      );
      cvRepo.save(modifiedCv);

      // 3. Kiểm tra bản chụp snapshot ban đầu đã cấp cho M04 (UC37)
      // Dữ liệu snapshot hoàn toàn không bị ảnh hưởng bởi bản cập nhật mới
      expect(snapshotInitial.title).toBe('CV Lập trình viên Backend NestJS');
      expect(snapshotInitial.summary).toBe('Có đam mê với kiến trúc hệ thống và microservices');
      expect(snapshotInitial.skills).toEqual(['NestJS', 'TypeScript', 'Docker', 'Redis']);
      expect(snapshotInitial.skills).not.toContain('PyTorch');
    });

    it('bản chụp snapshot đã cấp cho M04 vẫn bảo toàn nguyên vẹn ngay cả khi CV gốc bị xóa khỏi M02 (UC35)', async () => {
      mockProfileRepo.findById.mockResolvedValue(studentA);

      // Chụp snapshot nộp đơn
      const snapshotCaptured = await useCase.execute(studentA.id, cvOfStudentA.id);

      // Sinh viên xóa CV khỏi danh sách
      cvRepo.clear();

      // Snapshot của đơn ứng tuyển vẫn tồn tại đầy đủ thông tin độc lập
      expect(snapshotCaptured).toBeDefined();
      expect(snapshotCaptured.originalCvId).toBe(cvOfStudentA.id);
      expect(snapshotCaptured.title).toBe('CV Lập trình viên Backend NestJS');
      expect(snapshotCaptured.educations).toHaveLength(1);
    });
  });
});
