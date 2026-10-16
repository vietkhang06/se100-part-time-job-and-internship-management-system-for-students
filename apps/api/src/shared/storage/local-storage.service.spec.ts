import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { LocalStorageService } from './local-storage.service';
import {
  StoragePathTraversalException,
  InvalidStorageKeyException,
  FileNotFoundException,
  StorageException,
} from './storage.interface';

describe('LocalStorageService (W2-DO-01 Unit Tests)', () => {
  let tempStorageDir: string;
  let service: LocalStorageService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    // Create an isolated temporary test directory for each test
    tempStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'campusjob-storage-test-'));

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'LOCAL_STORAGE_PATH') {
          return tempStorageDir;
        }
        return defaultValue;
      }),
    } as any;

    service = new LocalStorageService(mockConfigService);
    service.onModuleInit();
  });

  afterEach(() => {
    // Clean up temporary test files
    try {
      if (fs.existsSync(tempStorageDir)) {
        fs.rmSync(tempStorageDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  describe('Store, Read, and Exists Operations', () => {
    it('should store file contents and return correct size and sha256 checksum', async () => {
      const content = Buffer.from('Hello CampusJob Storage Engine! Sample CV Document Content');
      const expectedChecksum = crypto.createHash('sha256').update(content).digest('hex');

      const result = await service.store({
        buffer: content,
        originalFilename: 'my-resume.pdf',
        mimeType: 'application/pdf',
      });

      expect(result.storageKey).toBeDefined();
      expect(result.storageKey.endsWith('.pdf')).toBe(true);
      expect(result.byteSize).toBe(content.length);
      expect(result.checksumSha256).toBe(expectedChecksum);

      // Verify file actually exists on disk
      const exists = await service.exists(result.storageKey);
      expect(exists).toBe(true);

      // Read content back and verify
      const readBuffer = await service.read(result.storageKey);
      expect(readBuffer.toString('utf-8')).toBe(content.toString('utf-8'));
    });

    it('should generate unpredictable UUID-based keys independently of user filenames', async () => {
      const buffer = Buffer.from('Identical content test');
      const result1 = await service.store({ buffer, originalFilename: 'same-name.pdf' });
      const result2 = await service.store({ buffer, originalFilename: 'same-name.pdf' });

      expect(result1.storageKey).not.toBe(result2.storageKey);
      expect(result1.storageKey).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.pdf$/);
      expect(result2.storageKey).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.pdf$/);
    });

    it('should handle original filenames without extension safely', async () => {
      const buffer = Buffer.from('No extension file');
      const result = await service.store({ buffer, originalFilename: 'raw-file' });

      expect(result.storageKey).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    });

    it('should throw FileNotFoundException when reading a nonexistent file', async () => {
      const randomKey = `${crypto.randomUUID()}.pdf`;
      await expect(service.read(randomKey)).rejects.toThrow(FileNotFoundException);
    });
  });

  describe('Delete Operations & Idempotency', () => {
    it('should delete an existing stored file and make it inaccessible', async () => {
      const buffer = Buffer.from('To be deleted');
      const { storageKey } = await service.store({ buffer });

      expect(await service.exists(storageKey)).toBe(true);

      await service.delete(storageKey);

      expect(await service.exists(storageKey)).toBe(false);
      await expect(service.read(storageKey)).rejects.toThrow(FileNotFoundException);
    });

    it('should succeed idempotently when deleting an already absent file', async () => {
      const randomKey = `${crypto.randomUUID()}.pdf`;
      // Should not throw error
      await expect(service.delete(randomKey)).resolves.toBeUndefined();
    });
  });

  describe('Path Traversal Prevention & Security Guards', () => {
    const maliciousKeys = [
      '../etc/passwd',
      '..\\windows\\system32\\cmd.exe',
      '../../secret.key',
      '/etc/shadow',
      'C:\\Windows\\System32\\calc.exe',
      'C:/boot.ini',
      'subfolder/../../secret',
      'key\0nullbyte.pdf',
      'malicious-file-name.exe',
      'not-a-uuid',
      '12345',
    ];

    it.each(maliciousKeys)('should reject illegal storage key: %s', async (key) => {
      await expect(service.read(key)).rejects.toThrow();
      await expect(service.delete(key)).rejects.toThrow();
      expect(await service.exists(key)).toBe(false);
    });

    it('should throw StorageException if storage root is configured inside src directory', () => {
      const srcStorageDir = path.resolve(process.cwd(), 'src', 'fake-uploads');

      const badConfigService = {
        get: jest.fn().mockReturnValue(srcStorageDir),
      } as any;

      expect(() => new LocalStorageService(badConfigService)).toThrow(StorageException);
    });

    it('should detect and reject symlink pointing outside storage root', async () => {
      const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'campusjob-ext-'));
      const secretFile = path.join(externalDir, 'secret.txt');
      fs.writeFileSync(secretFile, 'SUPER_SECRET_PAYLOAD');

      const symlinkKey = `${crypto.randomUUID()}.txt`;
      const symlinkPath = path.join(tempStorageDir, symlinkKey);

      try {
        fs.symlinkSync(secretFile, symlinkPath);
        await expect(service.read(symlinkKey)).rejects.toThrow(StoragePathTraversalException);
      } catch (e: any) {
        // On Windows environments where symlink creation requires elevated privileges, skip gracefully
        if (e.code !== 'EPERM') {
          throw e;
        }
      } finally {
        fs.rmSync(externalDir, { recursive: true, force: true });
      }
    });
  });
});
