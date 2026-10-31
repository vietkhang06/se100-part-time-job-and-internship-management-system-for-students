import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { FileAssetDto, FileAssetStatus } from '@campusjob/contracts';
import { FileAssetService } from '../../../../shared/storage/file-asset.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadFileInput {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
}

/**
 * Validates actual file binary content via magic signatures:
 * - PDF: begins with %PDF- (0x25 0x50 0x44 0x46 0x2D)
 * - DOC (CFB): begins with 0xD0 0xCF 0x11 0xE0 0xA1 0xB1 0x1A 0xE1
 * - DOCX (Zip archive): begins with PK\x03\x04 (0x50 0x4B 0x03 0x04)
 */
export function validateCvFileContent(buffer: Buffer, originalname?: string): string {
  if (!buffer || buffer.length < 4) {
    throw new BadRequestException('Tệp tải lên quá nhỏ hoặc bị rỗng/hỏng.');
  }

  // 1. PDF Verification
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  // 2. DOC (OLE2 Compound Document) Verification
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return 'application/msword';
  }

  // 3. DOCX (Zip Container PK\x03\x04) Verification
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    const ext = (originalname || '').toLowerCase();
    if (ext.endsWith('.docx') || ext.endsWith('.doc')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
  }

  throw new BadRequestException(
    'Nội dung tệp không hợp lệ hoặc không khớp với định dạng PDF/DOC/DOCX được hỗ trợ.',
  );
}

@Injectable()
export class UploadCvFileUseCase {
  constructor(private readonly fileAssetService: FileAssetService) {}

  async execute(userId: string, file: UploadFileInput): Promise<FileAssetDto> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Vui lòng chọn tệp tài liệu hợp lệ để tải lên.');
    }

    const fileSize = file.size ?? file.buffer.length;
    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException('Dung lượng tệp vượt quá giới hạn cho phép (tối đa 10MB).');
    }

    // Verify true binary content via magic bytes, preventing MIME spoofing
    const verifiedMimeType = validateCvFileContent(file.buffer, file.originalname);

    const storedAsset = await this.fileAssetService.storeFileAsset({
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: verifiedMimeType,
      ownerUserId: userId,
      status: FileAssetStatus.PENDING_UPLOAD,
    });

    return {
      id: storedAsset.id,
      ownerUserId: storedAsset.ownerUserId,
      originalName: storedAsset.originalName,
      mimeType: storedAsset.mimeType,
      sizeBytes: storedAsset.sizeBytes,
      checksumSha256: storedAsset.checksumSha256,
      storageKey: storedAsset.storageKey,
      status: storedAsset.status as FileAssetStatus,
      uploadedAt: storedAsset.uploadedAt.toISOString(),
      updatedAt: storedAsset.updatedAt.toISOString(),
    };
  }
}
