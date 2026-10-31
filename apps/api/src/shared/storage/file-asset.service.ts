import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Prisma, FileAssetStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  IStorageService,
  STORAGE_SERVICE_TOKEN,
} from './storage.interface';

export { FileAssetStatus };

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export interface StoreFileAssetOptions {
  buffer: Buffer;
  originalFilename?: string;
  mimeType: string;
  ownerUserId: string;
  status?: FileAssetStatus;
}

export interface FileAssetResult {
  id: string;
  ownerUserId: string;
  originalName: string | null;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  storageKey: string;
  status: FileAssetStatus;
  uploadedAt: Date;
  updatedAt: Date;
}

export type DeleteFileAssetOutcome =
  | 'DELETED'
  | 'STILL_REFERENCED'
  | 'RETAINED_PENDING_RETRY'
  | 'NOT_FOUND';

export interface DeleteFileAssetResult {
  deleted: boolean;
  outcome: DeleteFileAssetOutcome;
  assetStatus: FileAssetStatus | null;
  /** For backwards compatibility */
  status: 'DELETED' | 'IN_USE' | 'PENDING_DELETION' | 'NOT_FOUND';
  reason?: string;
}

@Injectable()
export class FileAssetService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FileAssetService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE_TOKEN)
    private readonly storageService: IStorageService,
  ) {}

  /**
   * Automatically triggered on application startup to clean up any orphaned or pending deletions
   * and purge abandoned draft uploads older than 24 hours.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const stats = await this.retryPendingDeletions();
      if (stats.attempted > 0) {
        this.logger.log(
          `OnApplicationBootstrap: Retried ${stats.attempted} pending file deletions (Succeeded: ${stats.succeeded}, Failed: ${stats.failed})`,
        );
      }

      // Cleanup abandoned uploads (draft uploads never attached to a CV or verification document)
      const abandonedStats = await this.cleanupAbandonedUploads();
      if (abandonedStats.attempted > 0) {
        this.logger.log(
          `OnApplicationBootstrap: Purged ${abandonedStats.succeeded}/${abandonedStats.attempted} abandoned unattached uploads`,
        );
      }
    } catch (err: unknown) {
      this.logger.warn(
        `OnApplicationBootstrap: Startup maintenance encountered an error: ${errorMessage(err)}`,
      );
    }
  }

  /**
   * Stores a file buffer to storage and persists FileAsset metadata.
   * If metadata persistence fails, compensates by deleting the stored physical file.
   */
  async storeFileAsset(options: StoreFileAssetOptions): Promise<FileAssetResult> {
    if (!options.buffer || !Buffer.isBuffer(options.buffer) || options.buffer.length === 0) {
      throw new BadRequestException('Buffer tệp không hợp lệ hoặc rỗng.');
    }
    if (!options.mimeType || typeof options.mimeType !== 'string') {
      throw new BadRequestException('MIME type không hợp lệ.');
    }
    if (!options.ownerUserId || typeof options.ownerUserId !== 'string') {
      throw new BadRequestException('ownerUserId không hợp lệ.');
    }

    // 1. Physical write to storage
    const stored = await this.storageService.store({
      buffer: options.buffer,
      originalFilename: options.originalFilename,
      mimeType: options.mimeType,
    });

    // 2. Persist metadata in database with compensation on failure
    try {
      const created = await this.prisma.fileAsset.create({
        data: {
          ownerUserId: options.ownerUserId,
          originalName: options.originalFilename ?? null,
          mimeType: options.mimeType,
          sizeBytes: stored.byteSize,
          checksumSha256: stored.checksumSha256,
          storageKey: stored.storageKey,
          status: options.status ?? FileAssetStatus.PERMANENT,
        },
      });

      return created;
    } catch (dbError: unknown) {
      this.logger.error(
        `Failed to persist FileAsset metadata for key [${stored.storageKey}]: ${errorMessage(dbError)}. Initiating rollback compensation.`,
      );

      // Rollback compensation: remove physical file
      try {
        await this.storageService.delete(stored.storageKey);
        this.logger.log(`Rollback compensation succeeded for key [${stored.storageKey}]`);
      } catch (cleanupError: unknown) {
        this.logger.error(
          `Rollback compensation failed for key [${stored.storageKey}]: ${errorMessage(cleanupError)}`,
        );
      }

      throw dbError;
    }
  }

  /**
   * Verifies that the requested FileAsset exists, is owned by the specified user,
   * and is not marked as PENDING_DELETION.
   */
  async verifyOwnership(fileAssetId: string, expectedOwnerUserId: string): Promise<FileAssetResult> {
    if (!fileAssetId || typeof fileAssetId !== 'string') {
      throw new BadRequestException('fileAssetId không hợp lệ.');
    }

    const asset = await this.prisma.fileAsset.findUnique({
      where: { id: fileAssetId },
    });

    if (!asset) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy tệp tài liệu tương ứng.',
        error: 'Not Found',
        code: 'FILE_ASSET_NOT_FOUND',
      });
    }

    if (asset.ownerUserId !== expectedOwnerUserId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không có quyền sử dụng hoặc liên kết tệp tài liệu này.',
        error: 'Forbidden',
        code: 'FILE_ASSET_FORBIDDEN',
      });
    }

    if (asset.status === 'PENDING_DELETION') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Tệp tài liệu này đang trong trạng thái chờ xóa và không thể sử dụng.',
        error: 'Bad Request',
        code: 'FILE_ASSET_PENDING_DELETION',
      });
    }

    return asset;
  }

  /**
   * Safely deletes a FileAsset with atomic race protection:
   * Phase 1: In a short DB transaction, check existing references and transition status to PENDING_DELETION.
   *          Once committed to PENDING_DELETION, any concurrent attachment attempt will be rejected.
   * Phase 2: Perform physical storage deletion outside the transaction (preventing DB connection lock contention).
   * Phase 3: On successful physical deletion, remove the DB record.
   *          On failed physical deletion, retain PENDING_DELETION status for startup/retry recovery.
   */
  async deleteFileAsset(
    fileAssetId: string,
    authorizedUserId?: string,
  ): Promise<DeleteFileAssetResult> {
    const transition = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Step 1: Mandatory row lock on FileAsset via $queryRaw to serialize against concurrent attachments
      await tx.$queryRaw`SELECT 1 FROM "FileAsset" WHERE "id" = ${fileAssetId} FOR UPDATE`;

      const asset = await tx.fileAsset.findUnique({
        where: { id: fileAssetId },
        include: {
          cv: true,
          companyVerificationDocuments: true,
        },
      });

      if (!asset) {
        return { outcome: 'NOT_FOUND' as const };
      }

      if (authorizedUserId && asset.ownerUserId !== authorizedUserId) {
        return { outcome: 'FORBIDDEN' as const };
      }

      const hasCv = !!asset.cv;
      const hasDoc =
        asset.companyVerificationDocuments && asset.companyVerificationDocuments.length > 0;

      if (hasCv || hasDoc) {
        return {
          outcome: 'STILL_REFERENCED' as const,
          storageKey: asset.storageKey,
          assetStatus: asset.status as FileAssetStatus,
        };
      }

      if (asset.status === FileAssetStatus.PENDING_DELETION) {
        return {
          outcome: 'ALREADY_PENDING' as const,
          storageKey: asset.storageKey,
          assetStatus: FileAssetStatus.PENDING_DELETION,
        };
      }

      // Atomically transition status to PENDING_DELETION while holding row verification
      await tx.fileAsset.update({
        where: { id: fileAssetId },
        data: { status: FileAssetStatus.PENDING_DELETION },
      });

      return {
        outcome: 'TRANSITIONED' as const,
        storageKey: asset.storageKey,
        assetStatus: FileAssetStatus.PENDING_DELETION,
      };
    });

    if (transition.outcome === 'NOT_FOUND') {
      return {
        deleted: false,
        outcome: 'NOT_FOUND',
        assetStatus: null,
        status: 'NOT_FOUND',
        reason: 'File asset does not exist',
      };
    }

    if (transition.outcome === 'FORBIDDEN') {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không có quyền xóa tệp tài liệu này.',
        error: 'Forbidden',
        code: 'FILE_ASSET_FORBIDDEN',
      });
    }

    if (transition.outcome === 'STILL_REFERENCED') {
      return {
        deleted: false,
        outcome: 'STILL_REFERENCED',
        assetStatus: FileAssetStatus.PERMANENT,
        status: 'IN_USE',
        reason:
          'FileAsset is still referenced by domain entities (Cv or CompanyVerificationDocument)',
      };
    }

    // Phase 2: Delete from physical storage outside DB transaction
    try {
      await this.storageService.delete(transition.storageKey);

      // Phase 3: Remove DB record now that physical deletion succeeded
      await this.prisma.fileAsset.delete({
        where: { id: fileAssetId },
      });

      return {
        deleted: true,
        outcome: 'DELETED',
        assetStatus: null,
        status: 'DELETED',
      };
    } catch (err: unknown) {
      this.logger.error(
        `Physical deletion failed for FileAsset [${fileAssetId}] (storageKey [${transition.storageKey}]): ${errorMessage(err)}. Retaining PENDING_DELETION status for retry.`,
      );

      return {
        deleted: false,
        outcome: 'RETAINED_PENDING_RETRY',
        assetStatus: FileAssetStatus.PENDING_DELETION,
        status: 'PENDING_DELETION',
        reason: `Physical storage deletion failed: ${errorMessage(err)}`,
      };
    }
  }

  /**
   * Cleans up unattached uploads that have remained in PENDING_UPLOAD status
   * longer than the expiration threshold (default: 24 hours).
   * Valid user files attached to a CV or document are PERMANENT and are never touched.
   */
  async cleanupAbandonedUploads(
    maxAgeMs: number = 24 * 60 * 60 * 1000,
  ): Promise<{ attempted: number; succeeded: number }> {
    const cutoffDate = new Date(Date.now() - maxAgeMs);

    const abandonedAssets = await this.prisma.fileAsset.findMany({
      where: {
        status: FileAssetStatus.PENDING_UPLOAD,
        uploadedAt: { lt: cutoffDate },
        cv: null,
        companyVerificationDocuments: { none: {} },
      },
    });

    let succeeded = 0;
    for (const asset of abandonedAssets || []) {
      try {
        const delResult = await this.deleteFileAsset(asset.id);
        if (delResult.deleted) {
          succeeded++;
        }
      } catch (err: unknown) {
        this.logger.warn(`Failed to cleanup abandoned upload [${asset.id}]: ${errorMessage(err)}`);
      }
    }

    return { attempted: (abandonedAssets || []).length, succeeded };
  }

  /**
   * Retries physical deletion for all FileAssets in PENDING_DELETION status.
   * Concurrency-safe: Re-verifies references transactionally before removing records.
   */
  async retryPendingDeletions(): Promise<{ attempted: number; succeeded: number; failed: number }> {
    const pendingAssets = await this.prisma.fileAsset.findMany({
      where: { status: FileAssetStatus.PENDING_DELETION },
      include: {
        cv: true,
        companyVerificationDocuments: true,
      },
    });

    let succeeded = 0;
    let failed = 0;

    for (const asset of pendingAssets || []) {
      const isReferenced =
        !!asset.cv ||
        (asset.companyVerificationDocuments && asset.companyVerificationDocuments.length > 0);

      if (isReferenced) {
        // Recover status if domain record was re-associated
        await this.prisma.fileAsset.update({
          where: { id: asset.id },
          data: { status: FileAssetStatus.PERMANENT },
        });
        continue;
      }

      try {
        // Idempotent storage deletion (already absent file returns success)
        await this.storageService.delete(asset.storageKey);

        // Transactional check-and-delete preventing race conditions with concurrent attachments
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.$queryRaw`SELECT 1 FROM "FileAsset" WHERE "id" = ${asset.id} FOR UPDATE`;

          const current = await tx.fileAsset.findUnique({
            where: { id: asset.id },
            include: { cv: true, companyVerificationDocuments: true },
          });

          if (!current) {
            return;
          }

          if (current.cv || (current.companyVerificationDocuments && current.companyVerificationDocuments.length > 0)) {
            // Concurrent re-attachment detected: restore PERMANENT
            await tx.fileAsset.update({
              where: { id: asset.id },
              data: { status: FileAssetStatus.PERMANENT },
            });
            return;
          }

          await tx.fileAsset.delete({
            where: { id: asset.id },
          });
        });

        succeeded++;
      } catch (err: unknown) {
        this.logger.warn(
          `Retry deletion failed for asset [${asset.id}] (storageKey: ${asset.storageKey}): ${errorMessage(err)}`,
        );
        failed++;
      }
    }

    return {
      attempted: pendingAssets.length,
      succeeded,
      failed,
    };
  }

  /**
   * Retrieves file content and metadata safely.
   */
  async getFile(
    fileAssetId: string,
    authorizedUserId?: string,
  ): Promise<{ fileAsset: FileAssetResult; buffer: Buffer }> {
    const asset = await this.prisma.fileAsset.findUnique({
      where: { id: fileAssetId },
    });

    if (!asset) {
      throw new NotFoundException('File asset không tồn tại.');
    }

    if (authorizedUserId && asset.ownerUserId !== authorizedUserId) {
      throw new ForbiddenException('Bạn không có quyền truy cập file asset này.');
    }

    const buffer = await this.storageService.read(asset.storageKey);

    return {
      fileAsset: asset,
      buffer,
    };
  }
}
