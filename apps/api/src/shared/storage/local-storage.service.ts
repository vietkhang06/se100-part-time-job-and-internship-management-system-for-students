import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  IStorageService,
  StoreFileOptions,
  StoredFileResult,
  StorageException,
  StoragePathTraversalException,
  InvalidStorageKeyException,
  FileNotFoundException,
} from './storage.interface';

// Strict UUIDv4 with optional extension regex (alphanumeric extension, 1-10 chars)
const STORAGE_KEY_REGEX = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(\.[a-zA-Z0-9]{1,10})?$/;

@Injectable()
export class LocalStorageService implements IStorageService, OnModuleInit {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly storageRoot: string;

  constructor(private readonly configService: ConfigService) {
    const configuredPath = this.configService.get<string>(
      'LOCAL_STORAGE_PATH',
      './var/uploads',
    );

    // Resolve relative path against process.cwd() or repository root
    this.storageRoot = path.resolve(process.cwd(), configuredPath);

    // Guard: ensure storageRoot cannot resolve into the source-code directory
    this.assertStorageRootOutsideSrc();
  }

  onModuleInit() {
    this.ensureDirectoryExists(this.storageRoot);
  }

  getStorageRoot(): string {
    return this.storageRoot;
  }

  private assertStorageRootOutsideSrc(): void {
    const srcDir = path.resolve(process.cwd(), 'src');
    const relativeToSrc = path.relative(srcDir, this.storageRoot);

    // If relativeToSrc does NOT start with '..' and is not absolute, it is inside srcDir
    if (!relativeToSrc.startsWith('..') && !path.isAbsolute(relativeToSrc)) {
      throw new StorageException(
        `Storage root directory [${this.storageRoot}] cannot reside within source directory [${srcDir}]`,
      );
    }
  }

  private ensureDirectoryExists(dir: string): void {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.log(`Initialized storage root directory: ${dir}`);
      }
    } catch (err: any) {
      throw new StorageException(
        `Failed to initialize storage directory [${dir}]: ${err.message}`,
      );
    }
  }

  /**
   * Validates storage key and resolves canonical path, strictly preventing path traversal.
   */
  private resolveSafePath(storageKey: string): string {
    if (!storageKey || typeof storageKey !== 'string') {
      throw new InvalidStorageKeyException('Storage key must be a non-empty string');
    }

    // Explicitly reject common traversal patterns before regex
    if (
      storageKey.includes('..') ||
      storageKey.includes('/') ||
      storageKey.includes('\\') ||
      storageKey.includes(':') ||
      storageKey.includes('\0')
    ) {
      throw new StoragePathTraversalException(
        `Storage key contains illegal path traversal characters: ${storageKey}`,
      );
    }

    // Enforce strict key naming format
    if (!STORAGE_KEY_REGEX.test(storageKey)) {
      throw new InvalidStorageKeyException(
        `Storage key does not match required format: ${storageKey}`,
      );
    }

    const resolved = path.resolve(this.storageRoot, storageKey);
    const relative = path.relative(this.storageRoot, resolved);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new StoragePathTraversalException(
        `Resolved path [${resolved}] escapes storage root [${this.storageRoot}]`,
      );
    }

    // Extra hardening: if the target already exists on disk, verify its real canonical path
    if (fs.existsSync(resolved)) {
      try {
        const realTarget = fs.realpathSync(resolved);
        const realRoot = fs.existsSync(this.storageRoot)
          ? fs.realpathSync(this.storageRoot)
          : this.storageRoot;
        const realRelative = path.relative(realRoot, realTarget);
        if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
          throw new StoragePathTraversalException(
            `Symlink target [${realTarget}] escapes storage root [${this.storageRoot}]`,
          );
        }
      } catch (err: any) {
        if (err instanceof StoragePathTraversalException) {
          throw err;
        }
        // If realpathSync fails due to ENOENT or access, allow standard flow
      }
    }

    return resolved;
  }

  /**
   * Generates a collision-resistant, unpredictable storage key independently of user filenames.
   */
  private generateStorageKey(originalFilename?: string): string {
    const uuid = crypto.randomUUID();
    let ext = '';

    if (originalFilename) {
      const rawExt = path.extname(originalFilename).toLowerCase();
      // Only keep alphanumeric characters in extension (max 10 chars)
      const sanitizedExt = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 10);
      if (sanitizedExt.length > 0) {
        ext = `.${sanitizedExt}`;
      }
    }

    return `${uuid}${ext}`;
  }

  async store(options: StoreFileOptions): Promise<StoredFileResult> {
    if (!options.buffer || !Buffer.isBuffer(options.buffer)) {
      throw new StorageException('Invalid file buffer provided for storage');
    }

    this.ensureDirectoryExists(this.storageRoot);

    const storageKey = this.generateStorageKey(options.originalFilename);
    const targetPath = this.resolveSafePath(storageKey);
    const tempPath = `${targetPath}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;

    try {
      // Calculate SHA-256 checksum and size
      const hash = crypto.createHash('sha256');
      hash.update(options.buffer);
      const checksumSha256 = hash.digest('hex');
      const byteSize = options.buffer.length;

      // Write to temporary file first to guarantee atomic persistence
      await fs.promises.writeFile(tempPath, options.buffer);

      // Rename atomically to target path
      await fs.promises.rename(tempPath, targetPath);

      return {
        storageKey,
        byteSize,
        checksumSha256,
      };
    } catch (err: any) {
      // Clean up temporary file if write or rename failed
      try {
        if (fs.existsSync(tempPath)) {
          await fs.promises.unlink(tempPath);
        }
      } catch {
        // Suppress secondary cleanup error
      }

      throw new StorageException(`Failed to store file [${storageKey}]: ${err.message}`);
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    const filePath = this.resolveSafePath(storageKey);

    try {
      return await fs.promises.readFile(filePath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new FileNotFoundException(`File not found with key [${storageKey}]`);
      }
      throw new StorageException(`Failed to read file [${storageKey}]: ${err.message}`);
    }
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = this.resolveSafePath(storageKey);

    try {
      await fs.promises.unlink(filePath);
      this.logger.log(`Deleted stored file [${storageKey}]`);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // Idempotent deletion: already absent is considered success
        this.logger.debug(`File [${storageKey}] already absent during delete operation`);
        return;
      }
      throw new StorageException(`Failed to delete file [${storageKey}]: ${err.message}`);
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafePath(storageKey);
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
