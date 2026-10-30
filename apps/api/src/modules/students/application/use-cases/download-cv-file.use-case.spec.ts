import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { JobSeekingStatus, UserRole } from '@campusjob/contracts';
import { DownloadCvFileUseCase } from './download-cv-file.use-case';
import { CvEntity } from '../../domain/entities/cv.entity';
import { StudentProfileEntity } from '../../domain/entities/student-profile.entity';
import { ICvRepository } from '../../domain/repositories/cv.repository.interface';
import { IStudentProfileRepository } from '../../domain/repositories/student-profile.repository.interface';
import { FileAssetService, FileAssetStatus } from '../../../../shared/storage/file-asset.service';
import { IStorageService } from '../../../../shared/storage/storage.interface';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { ApplicationStatus } from '@prisma/client';

describe('DownloadCvFileUseCase (S3-M02-02 CV/FileAsset Lifecycle & Ownership)', () => {
  let useCase: DownloadCvFileUseCase;
  let mockCvRepo: jest.Mocked<ICvRepository>;
  let mockProfileRepo: jest.Mocked<IStudentProfileRepository>;
  let mockFileAssetService: FileAssetService;
  let mockPrisma: PrismaService;
  let findApplication: jest.SpiedFunction<PrismaService['application']['findFirst']>;
  let getFile: jest.SpiedFunction<FileAssetService['getFile']>;

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
    JobSeekingStatus.ACTIVELY_LOOKING,
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
      findByStudentProfileId: jest.fn(), findById: jest.fn(), countByStudentProfileId: jest.fn(), create: jest.fn(),
      update: jest.fn(), setDefault: jest.fn(), delete: jest.fn(), findDefaultByStudentProfileId: jest.fn(),
      findLatestByStudentProfileId: jest.fn(), isCvInUse: jest.fn(),
    };
    mockProfileRepo = {
      findById: jest.fn(), findByUserId: jest.fn(), createOrFind: jest.fn(), updateByUserId: jest.fn(),
    };
    mockPrisma = new PrismaService();
    findApplication = jest.spyOn(mockPrisma.application, 'findFirst');
    const storage: jest.Mocked<IStorageService> = {
      store: jest.fn(), read: jest.fn(), delete: jest.fn(), exists: jest.fn(), getStorageRoot: jest.fn(),
    };
    mockFileAssetService = new FileAssetService(mockPrisma, storage);
    getFile = jest.spyOn(mockFileAssetService, 'getFile');

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
      getFile.mockResolvedValue({
        fileAsset: {
          id: 'file-asset-uuid-1',
          ownerUserId: 'user-owner-id',
          originalName: 'my_resume.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          checksumSha256: 'checksum-1',
          storageKey: 'resume.pdf',
          status: FileAssetStatus.PERMANENT,
          uploadedAt: new Date(),
          updatedAt: new Date(),
        },
        buffer: Buffer.from('%PDF-1.7 Authentic PDF test content'),
      });

      const result = await useCase.execute('user-owner-id', 'cv-1-id', UserRole.STUDENT);

      expect(result.fileName).toBe('my_resume.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.sizeBytes).toBe(1024);
      expect(result.buffer.toString()).toContain('%PDF-1.7');
      expect(getFile).toHaveBeenCalledWith('file-asset-uuid-1', 'user-owner-id');
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

      expect(getFile).not.toHaveBeenCalled();
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
      findApplication.mockResolvedValue({
        id: 'app-123',
        cvId: 'cv-1-id',
        studentId: 'profile-owner-id',
        jobId: 'job-999',
        cvSnapshot: {},
        coverLetter: null,
        status: ApplicationStatus.SUBMITTED,
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      getFile.mockResolvedValue({
        fileAsset: {
          id: 'file-asset-uuid-1',
          ownerUserId: 'user-owner-id',
          originalName: 'applicant_cv.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          checksumSha256: 'checksum-1',
          storageKey: 'resume.pdf',
          status: FileAssetStatus.PERMANENT,
          uploadedAt: new Date(),
          updatedAt: new Date(),
        },
        buffer: Buffer.from('%PDF-1.7 Applicant CV Content'),
      });

      const result = await useCase.execute('employer-user-id', 'cv-1-id', UserRole.EMPLOYER);

      expect(result.fileName).toBe('applicant_cv.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(getFile).toHaveBeenCalledWith('file-asset-uuid-1');
    });

    it('Chặn Nhà tuyển dụng với 403 Forbidden nếu không có hồ sơ ứng tuyển liên quan tới CV', async () => {
      mockCvRepo.findById.mockResolvedValue(sampleCvWithFile);
      findApplication.mockResolvedValue(null); // Không có đơn nào nộp CV này

      await expect(
        useCase.execute('employer-user-id', 'cv-1-id', UserRole.EMPLOYER),
      ).rejects.toThrow(ForbiddenException);

      expect(getFile).not.toHaveBeenCalled();
    });
  });

  describe('Luồng Quản trị viên (ADMIN / MODERATOR)', () => {
    it('Cho phép Admin tải tệp CV phục vụ kiểm duyệt và đối soát nội dung', async () => {
      mockCvRepo.findById.mockResolvedValue(sampleCvWithFile);
      getFile.mockResolvedValue({
        fileAsset: {
          id: 'file-asset-uuid-1',
          ownerUserId: 'user-owner-id',
          originalName: 'admin_audit.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4096,
          checksumSha256: 'checksum-1',
          storageKey: 'resume.pdf',
          status: FileAssetStatus.PERMANENT,
          uploadedAt: new Date(),
          updatedAt: new Date(),
        },
        buffer: Buffer.from('%PDF-1.7 Content for Admin Audit'),
      });

      const result = await useCase.execute('admin-user-id', 'cv-1-id', UserRole.ADMIN);

      expect(result.fileName).toBe('admin_audit.pdf');
      expect(getFile).toHaveBeenCalledWith('file-asset-uuid-1');
    });
  });
});
