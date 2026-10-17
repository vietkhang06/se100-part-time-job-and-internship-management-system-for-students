import { BadRequestException } from '@nestjs/common';
import { UploadCvFileUseCase } from './upload-cv-file.use-case';
import { FileAssetService, FileAssetStatus } from '../../../../shared/storage/file-asset.service';

describe('UploadCvFileUseCase', () => {
  let useCase: UploadCvFileUseCase;
  let mockFileAssetService: jest.Mocked<FileAssetService>;

  beforeEach(() => {
    mockFileAssetService = {
      storeFileAsset: jest.fn().mockResolvedValue({
        id: 'asset-uuid-1',
        ownerUserId: 'user-student-1',
        originalName: 'my_cv.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        checksumSha256: 'sha256checksumexample',
        storageKey: '550e8400-e29b-41d4-a716-446655440000.pdf',
        status: FileAssetStatus.PERMANENT,
        uploadedAt: new Date('2026-10-16T12:00:00Z'),
        updatedAt: new Date('2026-10-16T12:00:00Z'),
      }),
    } as any;

    useCase = new UploadCvFileUseCase(mockFileAssetService);
  });

  it('should successfully store valid PDF file with genuine %PDF- magic bytes and return FileAssetDto', async () => {
    const file = {
      buffer: Buffer.from('%PDF-1.7\nSample authentic PDF content bytes'),
      originalname: 'my_cv.pdf',
      mimetype: 'application/pdf',
      size: 2048,
    };

    const result = await useCase.execute('user-student-1', file);

    expect(mockFileAssetService.storeFileAsset).toHaveBeenCalledWith({
      buffer: file.buffer,
      originalFilename: 'my_cv.pdf',
      mimeType: 'application/pdf',
      ownerUserId: 'user-student-1',
      status: FileAssetStatus.PENDING_UPLOAD,
    });

    expect(result.id).toBe('asset-uuid-1');
    expect(result.ownerUserId).toBe('user-student-1');
  });

  it('should accept valid DOCX file with PK magic bytes', async () => {
    const file = {
      buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('Word document content')]),
      originalname: 'my_cv.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 4096,
    };

    const result = await useCase.execute('user-student-1', file);

    expect(mockFileAssetService.storeFileAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        status: FileAssetStatus.PENDING_UPLOAD,
      }),
    );
    expect(result.id).toBe('asset-uuid-1');
  });

  it('should reject spoofed file that claims to be PDF but has invalid magic bytes', async () => {
    const spoofedFile = {
      buffer: Buffer.from('MZ_EXECUTABLE_WINDOWS_BINARY_HEADER'),
      originalname: 'trojan_disguised_as_cv.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    };

    await expect(useCase.execute('user-student-1', spoofedFile)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockFileAssetService.storeFileAsset).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException if file is missing or buffer is empty', async () => {
    await expect(
      useCase.execute('user-student-1', { buffer: Buffer.alloc(0), mimetype: 'application/pdf' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if file size exceeds 10MB', async () => {
    const largeFile = {
      buffer: Buffer.from('x'),
      originalname: 'huge.pdf',
      mimetype: 'application/pdf',
      size: 11 * 1024 * 1024,
    };

    await expect(useCase.execute('user-student-1', largeFile)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException for unsupported file types like executable or images', async () => {
    const exeFile = {
      buffer: Buffer.from('MZ...'),
      originalname: 'program.exe',
      mimetype: 'application/x-msdownload',
      size: 1024,
    };

    await expect(useCase.execute('user-student-1', exeFile)).rejects.toThrow(
      BadRequestException,
    );
  });
});
