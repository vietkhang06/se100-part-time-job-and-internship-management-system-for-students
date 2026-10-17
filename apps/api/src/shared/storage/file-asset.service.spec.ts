import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FileAssetService, FileAssetStatus } from './file-asset.service';
import { IStorageService } from './storage.interface';
import { PrismaService } from '../database/prisma.service';

describe('FileAssetService (W2-DB-02 / W2-DO-01)', () => {
  let service: FileAssetService;
  let mockStorageService: jest.Mocked<IStorageService>;
  let mockPrisma: any;

  beforeEach(() => {
    mockStorageService = {
      store: jest.fn().mockResolvedValue({
        storageKey: '550e8400-e29b-41d4-a716-446655440000.pdf',
        byteSize: 1024,
        checksumSha256: 'abc123def456',
      }),
      read: jest.fn().mockResolvedValue(Buffer.from('test-content')),
      delete: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
      getStorageRoot: jest.fn().mockReturnValue('/var/uploads'),
    };

    mockPrisma = {
      fileAsset: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'asset-1' }]),
    };

    service = new FileAssetService(mockPrisma as PrismaService, mockStorageService);
  });

  describe('storeFileAsset', () => {
    it('should store physical file and persist FileAsset record successfully', async () => {
      const buffer = Buffer.from('test-cv-content');
      const mockCreatedAsset = {
        id: 'asset-uuid-1',
        ownerUserId: 'user-1',
        originalName: 'resume.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        checksumSha256: 'abc123def456',
        storageKey: '550e8400-e29b-41d4-a716-446655440000.pdf',
        status: FileAssetStatus.PERMANENT,
        uploadedAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.fileAsset.create.mockResolvedValue(mockCreatedAsset);

      const result = await service.storeFileAsset({
        buffer,
        originalFilename: 'resume.pdf',
        mimeType: 'application/pdf',
        ownerUserId: 'user-1',
      });

      expect(mockStorageService.store).toHaveBeenCalledWith({
        buffer,
        originalFilename: 'resume.pdf',
        mimeType: 'application/pdf',
      });
      expect(mockPrisma.fileAsset.create).toHaveBeenCalledWith({
        data: {
          ownerUserId: 'user-1',
          originalName: 'resume.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          checksumSha256: 'abc123def456',
          storageKey: '550e8400-e29b-41d4-a716-446655440000.pdf',
          status: FileAssetStatus.PERMANENT,
        },
      });
      expect(result.id).toBe('asset-uuid-1');
    });

    it('should compensate by deleting physical file if DB persistence fails', async () => {
      const buffer = Buffer.from('test-cv-content');
      mockPrisma.fileAsset.create.mockRejectedValue(new Error('DB Connection Timeout'));

      await expect(
        service.storeFileAsset({
          buffer,
          originalFilename: 'resume.pdf',
          mimeType: 'application/pdf',
          ownerUserId: 'user-1',
        }),
      ).rejects.toThrow('DB Connection Timeout');

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000.pdf',
      );
    });

    it('should throw BadRequestException if buffer is empty or invalid', async () => {
      await expect(
        service.storeFileAsset({
          buffer: Buffer.alloc(0),
          mimeType: 'application/pdf',
          ownerUserId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyOwnership', () => {
    it('should return asset if user is the legitimate owner', async () => {
      const mockAsset = {
        id: 'asset-1',
        ownerUserId: 'user-1',
        status: FileAssetStatus.PERMANENT,
      };
      mockPrisma.fileAsset.findUnique.mockResolvedValue(mockAsset);

      const result = await service.verifyOwnership('asset-1', 'user-1');
      expect(result.id).toBe('asset-1');
    });

    it('should throw NotFoundException if asset does not exist', async () => {
      mockPrisma.fileAsset.findUnique.mockResolvedValue(null);

      await expect(service.verifyOwnership('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if asset is owned by another user', async () => {
      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        ownerUserId: 'user-different',
        status: FileAssetStatus.PERMANENT,
      });

      await expect(service.verifyOwnership('asset-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if asset is in PENDING_DELETION status', async () => {
      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        ownerUserId: 'user-1',
        status: FileAssetStatus.PENDING_DELETION,
      });

      await expect(service.verifyOwnership('asset-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteFileAsset & multi-reference integrity', () => {
    it('should not delete physical file if asset is still referenced by a CV', async () => {
      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        ownerUserId: 'user-1',
        storageKey: 'key-1.pdf',
        status: FileAssetStatus.PERMANENT,
        cv: { id: 'cv-1' },
        companyVerificationDocuments: [],
      });

      const result = await service.deleteFileAsset('asset-1', 'user-1');
      expect(result.deleted).toBe(false);
      expect(result.outcome).toBe('STILL_REFERENCED');
      expect(result.assetStatus).toBe(FileAssetStatus.PERMANENT);
      expect(result.status).toBe('IN_USE');
      expect(mockStorageService.delete).not.toHaveBeenCalled();
      expect(mockPrisma.fileAsset.delete).not.toHaveBeenCalled();
    });

    it('should not delete physical file if referenced by CompanyVerificationDocument', async () => {
      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        ownerUserId: 'user-1',
        storageKey: 'key-1.pdf',
        status: FileAssetStatus.PERMANENT,
        cv: null,
        companyVerificationDocuments: [{ id: 'doc-1' }],
      });

      const result = await service.deleteFileAsset('asset-1', 'user-1');
      expect(result.deleted).toBe(false);
      expect(result.outcome).toBe('STILL_REFERENCED');
      expect(result.assetStatus).toBe(FileAssetStatus.PERMANENT);
      expect(mockStorageService.delete).not.toHaveBeenCalled();
    });

    it('should delete from storage and database when completely unreferenced', async () => {
      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        ownerUserId: 'user-1',
        storageKey: 'key-1.pdf',
        cv: null,
        companyVerificationDocuments: [],
      });
      mockPrisma.fileAsset.update.mockResolvedValue({});
      mockPrisma.fileAsset.delete.mockResolvedValue({});

      const result = await service.deleteFileAsset('asset-1', 'user-1');

      expect(mockPrisma.fileAsset.update).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
        data: { status: FileAssetStatus.PENDING_DELETION },
      });
      expect(mockStorageService.delete).toHaveBeenCalledWith('key-1.pdf');
      expect(mockPrisma.fileAsset.delete).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
      });
      expect(result.deleted).toBe(true);
      expect(result.outcome).toBe('DELETED');
      expect(result.assetStatus).toBeNull();
      expect(result.status).toBe('DELETED');
    });

    it('should acquire explicit row lock (FOR UPDATE) inside transaction before checking references to prevent race conditions', async () => {
      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        ownerUserId: 'user-1',
        storageKey: 'key-1.pdf',
        cv: null,
        companyVerificationDocuments: [],
      });
      mockPrisma.fileAsset.update.mockResolvedValue({});
      mockPrisma.fileAsset.delete.mockResolvedValue({});

      await service.deleteFileAsset('asset-1', 'user-1');

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should abort operation immediately and propagate error if row lock acquisition fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Lock acquisition failed: deadlock detected'));

      await expect(service.deleteFileAsset('asset-1', 'user-1')).rejects.toThrow(
        'Lock acquisition failed: deadlock detected',
      );

      expect(mockPrisma.fileAsset.findUnique).not.toHaveBeenCalled();
      expect(mockStorageService.delete).not.toHaveBeenCalled();
    });

    it('should retain PENDING_DELETION status if physical storage deletion fails', async () => {
      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        ownerUserId: 'user-1',
        storageKey: 'key-1.pdf',
        cv: null,
        companyVerificationDocuments: [],
      });
      mockPrisma.fileAsset.update.mockResolvedValue({});
      mockStorageService.delete.mockRejectedValue(new Error('Disk I/O Error'));

      const result = await service.deleteFileAsset('asset-1', 'user-1');

      expect(result.deleted).toBe(false);
      expect(result.outcome).toBe('RETAINED_PENDING_RETRY');
      expect(result.assetStatus).toBe(FileAssetStatus.PENDING_DELETION);
      expect(result.status).toBe('PENDING_DELETION');
      expect(mockPrisma.fileAsset.delete).not.toHaveBeenCalled();
    });
  });

  describe('retryPendingDeletions & OnApplicationBootstrap', () => {
    it('should retry physical deletion for PENDING_DELETION assets and remove record inside transaction', async () => {
      mockPrisma.fileAsset.findMany.mockResolvedValue([
        {
          id: 'asset-retry-1',
          storageKey: 'key-retry.pdf',
          cv: null,
          companyVerificationDocuments: [],
        },
      ]);
      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-retry-1',
        cv: null,
        companyVerificationDocuments: [],
      });
      mockPrisma.fileAsset.delete.mockResolvedValue({});

      const stats = await service.retryPendingDeletions();

      expect(stats.attempted).toBe(1);
      expect(stats.succeeded).toBe(1);
      expect(stats.failed).toBe(0);
      expect(mockStorageService.delete).toHaveBeenCalledWith('key-retry.pdf');
      expect(mockPrisma.fileAsset.delete).toHaveBeenCalledWith({
        where: { id: 'asset-retry-1' },
      });
    });

    it('should restore PERMANENT status if an asset was concurrently re-referenced', async () => {
      mockPrisma.fileAsset.findMany.mockResolvedValue([
        {
          id: 'asset-concurrent-1',
          storageKey: 'key-concurrent.pdf',
          cv: null,
          companyVerificationDocuments: [],
        },
      ]);
      // Concurrently attached before transaction commit
      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-concurrent-1',
        cv: { id: 'cv-new' },
        companyVerificationDocuments: [],
      });

      const stats = await service.retryPendingDeletions();

      expect(mockPrisma.fileAsset.update).toHaveBeenCalledWith({
        where: { id: 'asset-concurrent-1' },
        data: { status: FileAssetStatus.PERMANENT },
      });
      expect(mockPrisma.fileAsset.delete).not.toHaveBeenCalled();
    });

    it('should execute retryPendingDeletions on application bootstrap', async () => {
      const retrySpy = jest.spyOn(service, 'retryPendingDeletions').mockResolvedValue({
        attempted: 2,
        succeeded: 2,
        failed: 0,
      });

      await service.onApplicationBootstrap();

      expect(retrySpy).toHaveBeenCalled();
    });
  });
});
