import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CvErrorCode, JobSeekingStatus } from '@campusjob/contracts';
import { StudentProfileEntity } from '../../domain/entities/student-profile.entity';
import { CvEntity } from '../../domain/entities/cv.entity';
import { ICvRepository } from '../../domain/repositories/cv.repository.interface';
import { IStudentProfileRepository } from '../../domain/repositories/student-profile.repository.interface';
import { ListCvsUseCase } from './list-cvs.use-case';
import { GetCvDetailUseCase } from './get-cv-detail.use-case';
import { CreateCvUseCase } from './create-cv.use-case';
import { UpdateCvUseCase } from './update-cv.use-case';
import { SetDefaultCvUseCase } from './set-default-cv.use-case';
import { DeleteCvUseCase } from './delete-cv.use-case';

describe('CV Management Use Cases (S2-M02-04 Vertical Slice)', () => {
  let mockCvRepo: jest.Mocked<ICvRepository>;
  let mockProfileRepo: jest.Mocked<IStudentProfileRepository>;

  const studentAProfile = new StudentProfileEntity(
    'profile-a-id',
    'user-a-id',
    'Nguyễn Văn A',
    'student.a@example.com',
    '0901234567',
    null,
    'ĐH CNTT',
    'KTPM',
    2025,
    JobSeekingStatus.ACTIVELY_LOOKING,
  );

  const studentBProfile = new StudentProfileEntity(
    'profile-b-id',
    'user-b-id',
    'Trần Thị B',
    'student.b@example.com',
    '0909876543',
    null,
    'ĐH Bách Khoa',
    'KHMT',
    2025,
    JobSeekingStatus.ACTIVELY_LOOKING,
  );

  const cvA1 = new CvEntity(
    'cv-a1-id',
    studentAProfile.id,
    studentAProfile.userId,
    'CV Lập trình viên Backend Node.js',
    'Tóm tắt A1',
    true, // default
    null,
    ['TypeScript', 'NestJS'],
    [],
    [],
    [],
    [],
    new Date('2026-10-12T00:00:00Z'),
    new Date('2026-10-12T00:00:00Z'),
  );

  const cvA2 = new CvEntity(
    'cv-a2-id',
    studentAProfile.id,
    studentAProfile.userId,
    'CV Kỹ sư Dữ liệu',
    'Tóm tắt A2',
    false,
    null,
    ['Python', 'SQL'],
    [],
    [],
    [],
    [],
    new Date('2026-10-13T00:00:00Z'),
    new Date('2026-10-13T00:00:00Z'),
  );

  beforeEach(() => {
    mockCvRepo = {
      findByStudentProfileId: jest.fn(),
      findById: jest.fn(),
      countByStudentProfileId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setDefault: jest.fn(),
      delete: jest.fn(),
      findDefaultByStudentProfileId: jest.fn(),
      findLatestByStudentProfileId: jest.fn(),
      isCvInUse: jest.fn(),
    };

    mockProfileRepo = {
      findByUserId: jest.fn(),
      createOrFind: jest.fn(),
      updateByUserId: jest.fn(),
    };
  });

  describe('Tiêu chí nghiệm thu 1: Chỉ chủ CV được thao tác (Ownership & Anti-IDOR)', () => {
    it('UC31 – ListCvsUseCase chỉ trả về danh sách CV của sinh viên đang đăng nhập', async () => {
      mockProfileRepo.createOrFind.mockResolvedValue(studentAProfile);
      mockCvRepo.findByStudentProfileId.mockResolvedValue([cvA1, cvA2]);

      const useCase = new ListCvsUseCase(mockCvRepo, mockProfileRepo);
      const result = await useCase.execute(studentAProfile.userId);

      expect(mockProfileRepo.createOrFind).toHaveBeenCalledWith('user-a-id');
      expect(mockCvRepo.findByStudentProfileId).toHaveBeenCalledWith('profile-a-id');
      expect(result.total).toBe(2);
      expect(result.data[0].id).toBe('cv-a1-id');
    });

    it('UC32 – GetCvDetailUseCase từ chối khi sinh viên B cố tình xem CV của sinh viên A (chống IDOR)', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(studentBProfile); // Người gọi là sinh viên B
      mockCvRepo.findById.mockResolvedValue(cvA1); // CV thuộc về sinh viên A

      const useCase = new GetCvDetailUseCase(mockCvRepo, mockProfileRepo);

      await expect(
        useCase.execute('user-b-id', 'cv-a1-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('UC34 – UpdateCvUseCase từ chối khi người dùng không sở hữu CV', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(studentBProfile);
      mockCvRepo.findById.mockResolvedValue(cvA1);

      const useCase = new UpdateCvUseCase(mockCvRepo, mockProfileRepo);

      await expect(
        useCase.execute('user-b-id', 'cv-a1-id', { title: 'Hacked Title' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('UC35 – DeleteCvUseCase từ chối khi người dùng không sở hữu CV', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(studentBProfile);
      mockCvRepo.findById.mockResolvedValue(cvA1);

      const useCase = new DeleteCvUseCase(mockCvRepo, mockProfileRepo);

      await expect(
        useCase.execute('user-b-id', 'cv-a1-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Tiêu chí nghiệm thu 2: Chỉ có một CV mặc định (Default CV Invariant)', () => {
    it('UC33 – Tạo CV đầu tiên tự động được gán isDefault = true', async () => {
      mockProfileRepo.createOrFind.mockResolvedValue(studentAProfile);
      mockCvRepo.countByStudentProfileId.mockResolvedValue(0); // Chưa có CV nào

      const createdCv = new CvEntity(
        'new-cv-id',
        studentAProfile.id,
        studentAProfile.userId,
        'CV Đầu Tiên',
        null,
        true, // Đã được gán true
      );
      mockCvRepo.create.mockResolvedValue(createdCv);

      const useCase = new CreateCvUseCase(mockCvRepo, mockProfileRepo);
      const result = await useCase.execute('user-a-id', {
        title: 'CV Đầu Tiên',
        isDefault: false, // Sinh viên truyền false nhưng hệ thống phải cưỡng chế true
      });

      expect(mockCvRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: true }),
      );
      expect(result.cv.isDefault).toBe(true);
    });

    it('UC33 – Từ chối tạo CV mới khi đã đủ 10 CV (CV_LIMIT_EXCEEDED)', async () => {
      mockProfileRepo.createOrFind.mockResolvedValue(studentAProfile);
      mockCvRepo.countByStudentProfileId.mockResolvedValue(10); // Đã có 10 CV

      const useCase = new CreateCvUseCase(mockCvRepo, mockProfileRepo);

      await expect(
        useCase.execute('user-a-id', { title: 'CV thứ 11' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('UC34 – Cập nhật CV: Từ chối hủy cờ mặc định của CV mặc định DUY NHẤT (CANNOT_UNSET_ONLY_DEFAULT_CV)', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(studentAProfile);
      mockCvRepo.findById.mockResolvedValue(cvA1); // cvA1 là default
      mockCvRepo.countByStudentProfileId.mockResolvedValue(1); // Chỉ có đúng 1 CV

      const useCase = new UpdateCvUseCase(mockCvRepo, mockProfileRepo);

      await expect(
        useCase.execute('user-a-id', 'cv-a1-id', { isDefault: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('UC34 – SetDefaultCvUseCase kích hoạt đổi cờ mặc định thành công', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(studentAProfile);
      mockCvRepo.findById.mockResolvedValue(cvA2);
      mockCvRepo.setDefault.mockResolvedValue(undefined);

      const useCase = new SetDefaultCvUseCase(mockCvRepo, mockProfileRepo);
      const result = await useCase.execute('user-a-id', 'cv-a2-id');

      expect(mockCvRepo.setDefault).toHaveBeenCalledWith('profile-a-id', 'cv-a2-id');
      expect(result.isDefault).toBe(true);
    });

    it('UC35 – Xóa CV mặc định: tự động chuyển quyền mặc định sang CV còn lại gần nhất', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(studentAProfile);
      mockCvRepo.findById.mockResolvedValue(cvA1); // Xóa CV default cvA1
      mockCvRepo.isCvInUse.mockResolvedValue(false); // Không bị ràng buộc đơn ứng tuyển
      mockCvRepo.findLatestByStudentProfileId.mockResolvedValue(cvA2); // CV còn lại cvA2

      const useCase = new DeleteCvUseCase(mockCvRepo, mockProfileRepo);
      await useCase.execute('user-a-id', 'cv-a1-id');

      // Tự động gán CV cvA2 làm mặc định
      expect(mockCvRepo.setDefault).toHaveBeenCalledWith('profile-a-id', 'cv-a2-id');
      expect(mockCvRepo.delete).toHaveBeenCalledWith('cv-a1-id');
    });
  });

  describe('Tiêu chí nghiệm thu 3: Bảo toàn dữ liệu đơn ứng tuyển (UC35 Rule & Contract C-03)', () => {
    it('UC35 – Từ chối xóa nếu CV đang được sử dụng trong hồ sơ ứng tuyển hoạt động (CV_IN_USE_CANNOT_DELETE)', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(studentAProfile);
      mockCvRepo.findById.mockResolvedValue(cvA1);
      mockCvRepo.isCvInUse.mockResolvedValue(true); // Đang được dùng trong hồ sơ ứng tuyển

      const useCase = new DeleteCvUseCase(mockCvRepo, mockProfileRepo);

      await expect(
        useCase.execute('user-a-id', 'cv-a1-id'),
      ).rejects.toThrow(ConflictException);

      expect(mockCvRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('Tiêu chí nghiệm thu 4: Tích hợp FileAsset & Storage Lifecycle (W2-DB-02 & W2-DO-01)', () => {
    it('UC33 – Tạo CV mới với fileAssetId thuộc sở hữu hợp lệ sẽ kiểm tra quyền sở hữu', async () => {
      mockProfileRepo.createOrFind.mockResolvedValue(studentAProfile);
      mockCvRepo.countByStudentProfileId.mockResolvedValue(1);
      mockCvRepo.create.mockResolvedValue(cvA2);

      const mockFileAssetService = {
        verifyOwnership: jest.fn().mockResolvedValue({ id: 'file-asset-uuid-1', ownerUserId: 'user-a-id' }),
      } as any;

      const useCase = new CreateCvUseCase(mockCvRepo, mockProfileRepo, mockFileAssetService);
      const res = await useCase.execute('user-a-id', {
        title: 'CV Mới Kèm File',
        fileAssetId: 'file-asset-uuid-1',
      });

      expect(mockFileAssetService.verifyOwnership).toHaveBeenCalledWith('file-asset-uuid-1', 'user-a-id');
      expect(mockCvRepo.create).toHaveBeenCalled();
      expect(res.cv.id).toBe(cvA2.id);
    });

    it('UC34 – Cập nhật CV với fileAssetId của người khác sẽ bị từ chối với ForbiddenException', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(studentAProfile);
      mockCvRepo.findById.mockResolvedValue(cvA2);

      const mockFileAssetService = {
        verifyOwnership: jest.fn().mockRejectedValue(new ForbiddenException('Bạn không có quyền')),
      } as any;

      const useCase = new UpdateCvUseCase(mockCvRepo, mockProfileRepo, mockFileAssetService);

      await expect(
        useCase.execute('user-a-id', cvA2.id, {
          title: 'CV Hack File',
          fileAssetId: 'foreign-file-asset-id',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('UC35 – Xóa CV có đính kèm fileAssetId kích hoạt dọn dẹp an toàn qua FileAssetService', async () => {
      const cvWithFile = new CvEntity(
        'cv-file-id',
        studentAProfile.id,
        studentAProfile.userId,
        'CV Có File',
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
        'file-asset-uuid-123',
      );

      mockProfileRepo.findByUserId.mockResolvedValue(studentAProfile);
      mockCvRepo.findById.mockResolvedValue(cvWithFile);
      mockCvRepo.isCvInUse.mockResolvedValue(false);

      const mockFileAssetService = {
        deleteFileAsset: jest.fn().mockResolvedValue({ deleted: true, status: 'DELETED' }),
      } as any;

      const useCase = new DeleteCvUseCase(mockCvRepo, mockProfileRepo, mockFileAssetService);
      const result = await useCase.execute('user-a-id', 'cv-file-id');

      expect(mockCvRepo.delete).toHaveBeenCalledWith('cv-file-id');
      expect(mockFileAssetService.deleteFileAsset).toHaveBeenCalledWith('file-asset-uuid-123', 'user-a-id');
      expect(result.deletedCvId).toBe('cv-file-id');
    });

    it('UC35 – Khi dọn dẹp file thất bại, use case ghi nhận cảnh báo mà vẫn hoàn tất việc xóa CV', async () => {
      const cvWithFile = new CvEntity(
        'cv-file-id-fail',
        studentAProfile.id,
        studentAProfile.userId,
        'CV Có File Lỗi Storage',
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
        'file-asset-uuid-456',
      );

      mockProfileRepo.findByUserId.mockResolvedValue(studentAProfile);
      mockCvRepo.findById.mockResolvedValue(cvWithFile);
      mockCvRepo.isCvInUse.mockResolvedValue(false);

      const mockFileAssetService = {
        deleteFileAsset: jest.fn().mockRejectedValue(new Error('Storage I/O Error')),
      } as any;

      const useCase = new DeleteCvUseCase(mockCvRepo, mockProfileRepo, mockFileAssetService);
      const result = await useCase.execute('user-a-id', 'cv-file-id-fail');

      expect(mockCvRepo.delete).toHaveBeenCalledWith('cv-file-id-fail');
      expect(mockFileAssetService.deleteFileAsset).toHaveBeenCalledWith('file-asset-uuid-456', 'user-a-id');
      expect(result.deletedCvId).toBe('cv-file-id-fail');
    });
  });
});
