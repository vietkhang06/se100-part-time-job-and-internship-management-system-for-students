import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole, CvErrorCode } from '@campusjob/contracts';
import { DownloadCvFileUseCase } from './download-cv-file.use-case';
import { CvEntity } from '../../domain/entities/cv.entity';
import { StudentProfileEntity } from '../../domain/entities/student-profile.entity';

describe('DownloadCvFileUseCase (S3-M02-02 CV/FileAsset Lifecycle & Ownership)', () => {
  let useCase: DownloadCvFileUseCase;
  let mockCvRepo: any;
  let mockProfileRepo: any;
  let mockFileAssetService: any;
  let mockPrisma: any;

  const sampleStudentProfile = new StudentProfileEntity(
    'profile-owner-id',
    'user-owner-id',
    'Nguyễn Văn A',
    'student.a@example.com',
    null,
    null,
    'ĐHBK',
    'KTPM',
    2026,
    'ACTIVELY_LOOKING' as any,
    null,
    ['TypeScript'],
    false,
    null,
    new Date(),
    new Date(),
  );

  const sampleCvWithFile = new CvEntity(
    'cv-1-id',
    'profile-owner-id',
    'user-owner-id',
    'CV Lập Trình Viên Backend',
    'Tóm tắt CV',
    true,
    'https://storage.local/cv.pdf',
    ['TypeScript', 'NestJS'],
    [],
    [],
    [],
    [],
    new Date(),
    new Date(),
    'file-asset-uuid-1',
  );

  const sampleCvWithoutFile = new CvEntity(
    'cv-nofile-id',
    'profile-owner-id',
    'user-owner-id',
    'CV Không Kèm File',
    null,
    false,
    null,
    ['NodeJS'],
    [],
    [],
    [],
    [],
    new Date(),
    new Date(),
    null,
  );

  beforeEach(() => {
    mockCvRepo = {
      findById: jest.fn(),
    };
    mockProfileRepo = {
      findByUserId: jest.fn(),
    };
    mockFileAssetService = {
      getFile: jest.fn(),
    };
    mockPrisma = {
      application: {
        findFirst: jest.fn(),
      },
    };

    useCase = new DownloadCvFileUseCase(
      mockCvRepo,
      mockProfileRepo,
      mockFileAssetService,
      mockPrisma,
    );
  });

  describe('Luồng sinh viên tải tệp CV (STUDENT)', () => {
    it('LIFECYCLE-06: Cho phép sinh viên chủ sở hữu tải xuống tệp CV của mình thành công', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(sampleStudentProfile);
      mockCvRepo.findById.mockResolvedValue(sampleCvWithFile);
      mockFileAssetService.getFile.mockResolvedValue({
        fileAsset: {
          id: 'file-asset-uuid-1',
          ownerUserId: 'user-owner-id',
          originalName: 'my_resume.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
        buffer: Buffer.from('%PDF-1.7 Authentic PDF test content'),
      });

      const result = await useCase.execute('user-owner-id', 'cv-1-id', UserRole.STUDENT);

      expect(result.fileName).toBe('my_resume.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.sizeBytes).toBe(1024);
      expect(result.buffer.toString()).toContain('%PDF-1.7');
      expect(mockFileAssetService.getFile).toHaveBeenCalledWith('file-asset-uuid-1', 'user-owner-id');
    });

    it('LIFECYCLE-07: Từ chối với 404 (Anti-IDOR) nếu sinh viên cố tải CV của người khác', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(sampleStudentProfile);
      const alienCv = new CvEntity(
        'alien-cv-id',
        'alien-profile-id',
        'alien-user-id',
        'CV của người khác',
        null,
        false,
        null,
        [],
        [],
        [],
        [],
        [],
        new Date(),
        new Date(),
        'alien-asset-id',
      );
      mockCvRepo.findById.mockResolvedValue(alienCv);

      await expect(
        useCase.execute('user-owner-id', 'alien-cv-id', UserRole.STUDENT),
      ).rejects.toThrow(NotFoundException);

      expect(mockFileAssetService.getFile).not.toHaveBeenCalled();
    });

    it('LIFECYCLE-08: Trả về 404 nếu CV không có tệp tài liệu đính kèm (fileAssetId is null)', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(sampleStudentProfile);
      mockCvRepo.findById.mockResolvedValue(sampleCvWithoutFile);

      await expect(
        useCase.execute('user-owner-id', 'cv-nofile-id', UserRole.STUDENT),
      ).rejects.toThrow(NotFoundException);
    });

    it('Trả về 404 nếu CV hoàn toàn không tồn tại trong hệ thống', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(sampleStudentProfile);
      mockCvRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute('user-owner-id', 'non-existent-cv', UserRole.STUDENT),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Luồng nhà tuyển dụng xem/tải tệp CV (EMPLOYER)', () => {
    it('Cho phép Nhà tuyển dụng tải CV nếu sinh viên đã nộp đơn ứng tuyển chứa CV này', async () => {
      mockCvRepo.findById.mockResolvedValue(sampleCvWithFile);
      mockPrisma.application.findFirst.mockResolvedValue({
        id: 'app-123',
        cvId: 'cv-1-id',
        studentId: 'profile-owner-id',
        jobId: 'job-999',
      });
      mockFileAssetService.getFile.mockResolvedValue({
        fileAsset: {
          id: 'file-asset-uuid-1',
          ownerUserId: 'user-owner-id',
          originalName: 'applicant_cv.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
        },
        buffer: Buffer.from('%PDF-1.7 Applicant CV Content'),
      });

      const result = await useCase.execute('employer-user-id', 'cv-1-id', UserRole.EMPLOYER);

      expect(result.fileName).toBe('applicant_cv.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(mockFileAssetService.getFile).toHaveBeenCalledWith('file-asset-uuid-1');
    });

    it('Chặn Nhà tuyển dụng với 403 Forbidden nếu không có hồ sơ ứng tuyển liên quan tới CV', async () => {
      mockCvRepo.findById.mockResolvedValue(sampleCvWithFile);
      mockPrisma.application.findFirst.mockResolvedValue(null); // Không có đơn nào nộp CV này

      await expect(
        useCase.execute('employer-user-id', 'cv-1-id', UserRole.EMPLOYER),
      ).rejects.toThrow(ForbiddenException);

      expect(mockFileAssetService.getFile).not.toHaveBeenCalled();
    });
  });

  describe('Luồng Quản trị viên (ADMIN / MODERATOR)', () => {
    it('Cho phép Admin tải tệp CV phục vụ kiểm duyệt và đối soát nội dung', async () => {
      mockCvRepo.findById.mockResolvedValue(sampleCvWithFile);
      mockFileAssetService.getFile.mockResolvedValue({
        fileAsset: {
          id: 'file-asset-uuid-1',
          ownerUserId: 'user-owner-id',
          originalName: 'admin_audit.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4096,
        },
        buffer: Buffer.from('%PDF-1.7 Content for Admin Audit'),
      });

      const result = await useCase.execute('admin-user-id', 'cv-1-id', UserRole.ADMIN);

      expect(result.fileName).toBe('admin_audit.pdf');
      expect(mockFileAssetService.getFile).toHaveBeenCalledWith('file-asset-uuid-1');
    });
  });
});
