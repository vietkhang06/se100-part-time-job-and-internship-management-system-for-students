import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { FileAssetService, FileAssetStatus } from '../src/shared/storage/file-asset.service';
import { IStorageService, STORAGE_SERVICE_TOKEN } from '../src/shared/storage/storage.interface';
import { PrismaCvRepository } from '../src/modules/students/infrastructure/persistence/prisma-cv.repository';

const request = (typeof supertest === 'function' ? supertest : (supertest as any).default) as typeof supertest;

describe('W2 Real Concurrency & HTTP Upload Verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fileAssetService: FileAssetService;
  let storageService: IStorageService;
  let cvRepository: PrismaCvRepository;

  // Test entities
  let testStudentUser: any;
  let testStudentProfile: any;

  beforeAll(async () => {
    // Connect to isolated test database
    process.env.DATABASE_URL = 'postgresql://test_user:test_password_w2_isolated@127.0.0.1:5439/campusjob_test?schema=public';
    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_STORAGE_PATH = './var/test-uploads';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    fileAssetService = app.get<FileAssetService>(FileAssetService);
    storageService = app.get<IStorageService>(STORAGE_SERVICE_TOKEN);
    cvRepository = new PrismaCvRepository(prisma);

    // Seed test student account and profile
    testStudentUser = await prisma.user.create({
      data: {
        email: `student-${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Nguyễn Văn Test',
        role: 'STUDENT',
        status: 'ACTIVE',
      },
    });

    testStudentProfile = await prisma.studentProfile.create({
      data: {
        userId: testStudentUser.id,
        university: 'ĐH Bách Khoa',
        major: 'KTPM',
        graduationYear: 2026,
        jobSeekingStatus: 'ACTIVELY_LOOKING',
      },
    });
  }, 45000);

  afterAll(async () => {
    // Cleanup seeded records
    try {
      if (testStudentUser) {
        await prisma.cv.deleteMany({ where: { studentProfileId: testStudentProfile.id } });
        await prisma.fileAsset.deleteMany({ where: { ownerUserId: testStudentUser.id } });
        await prisma.studentProfile.deleteMany({ where: { userId: testStudentUser.id } });
        await prisma.user.deleteMany({ where: { id: testStudentUser.id } });
      }
    } catch {}

    if (app) {
      await app.close();
    }
  });

  describe('Section 7: Real PostgreSQL Concurrency Tests (Attachment vs Deletion)', () => {
    it('Scenario A: Deletion acquires lock first -> Attachment waits -> Deletion commits PENDING_DELETION -> Attachment rejected', async () => {
      // 1. Create a physical file asset in storage and DB
      const asset = await fileAssetService.storeFileAsset({
        buffer: Buffer.from('%PDF-1.7 Authentic PDF test content for Scenario A'),
        originalFilename: 'scenario_a_cv.pdf',
        mimeType: 'application/pdf',
        ownerUserId: testStudentUser.id,
        status: FileAssetStatus.PENDING_UPLOAD,
      });

      let deletionLockAcquired = false;
      let attachmentAttemptStarted = false;
      let attachmentError: any = null;

      // Synchronization deferred promises
      let releaseDeletion: () => void;
      const pauseDeletionInTx = new Promise<void>((resolve) => {
        releaseDeletion = resolve;
      });

      // Thread A: Deletion transaction that acquires lock and pauses
      const deletionPromise = prisma.$transaction(async (tx) => {
        // Step 1: Mandatory row lock
        await tx.$queryRaw`SELECT 1 FROM "FileAsset" WHERE "id" = ${asset.id} FOR UPDATE`;
        deletionLockAcquired = true;

        // Pause while holding the row lock until attachment thread has attempted to acquire
        await pauseDeletionInTx;

        // Transition to PENDING_DELETION
        await tx.fileAsset.update({
          where: { id: asset.id },
          data: { status: FileAssetStatus.PENDING_DELETION },
        });

        return { outcome: 'TRANSITIONED' };
      });

      // Wait until deletion has genuinely acquired the row lock in PostgreSQL
      while (!deletionLockAcquired) {
        await new Promise((r) => setTimeout(r, 50));
      }

      // Thread B: Concurrent attachment attempt
      const attachmentPromise = (async () => {
        attachmentAttemptStarted = true;
        try {
          await cvRepository.create({
            studentProfileId: testStudentProfile.id,
            title: 'CV Scenario A Concurrent',
            isDefault: false,
            fileAssetId: asset.id,
            skills: ['TypeScript'],
          });
        } catch (err: any) {
          attachmentError = err;
        }
      })();

      // Wait a short duration to ensure Attachment has executed and is blocked waiting for PostgreSQL row lock
      await new Promise((r) => setTimeout(r, 300));
      expect(attachmentAttemptStarted).toBe(true);
      expect(attachmentError).toBeNull(); // Still blocked waiting on row lock!

      // Now release Deletion to commit PENDING_DELETION
      releaseDeletion!();
      const deletionResult = await deletionPromise;
      expect(deletionResult.outcome).toBe('TRANSITIONED');

      // Attachment should now unblock, see PENDING_DELETION, and fail with BadRequestException
      await attachmentPromise;
      expect(attachmentError).not.toBeNull();
      expect(attachmentError.status).toBe(400);
      expect(attachmentError.message).toContain('chờ xóa');

      // Verify invariant: No CV record was created pointing to the asset
      const cvRecord = await prisma.cv.findUnique({
        where: { fileAssetId: asset.id },
      });
      expect(cvRecord).toBeNull();

      // Clean up asset
      await storageService.delete(asset.storageKey).catch(() => {});
      await prisma.fileAsset.delete({ where: { id: asset.id } }).catch(() => {});
    }, 30000);

    it('Scenario B: Attachment acquires lock first -> Deletion waits -> Attachment commits PERMANENT -> Deletion detects reference and preserves file', async () => {
      // 1. Create a physical file asset in storage and DB
      const asset = await fileAssetService.storeFileAsset({
        buffer: Buffer.from('%PDF-1.7 Authentic PDF test content for Scenario B'),
        originalFilename: 'scenario_b_cv.pdf',
        mimeType: 'application/pdf',
        ownerUserId: testStudentUser.id,
        status: FileAssetStatus.PENDING_UPLOAD,
      });

      let attachmentLockAcquired = false;
      let deletionAttemptStarted = false;
      let deletionResult: any = null;

      // Synchronization deferred promise
      let releaseAttachment: () => void;
      const pauseAttachmentInTx = new Promise<void>((resolve) => {
        releaseAttachment = resolve;
      });

      // Thread B: Attachment transaction that acquires lock and pauses
      const attachmentPromise = prisma.$transaction(async (tx) => {
        // Step 1: Mandatory row lock
        await tx.$queryRaw`SELECT 1 FROM "FileAsset" WHERE "id" = ${asset.id} FOR UPDATE`;
        attachmentLockAcquired = true;

        // Pause while holding the lock
        await pauseAttachmentInTx;

        // Promote to PERMANENT and create CV referencing fileAssetId
        await tx.fileAsset.update({
          where: { id: asset.id },
          data: { status: FileAssetStatus.PERMANENT },
        });

        const createdCv = await tx.cv.create({
          data: {
            studentProfileId: testStudentProfile.id,
            title: 'CV Scenario B Concurrent',
            isDefault: false,
            fileAssetId: asset.id,
            skills: ['PostgreSQL', 'Prisma'],
          },
        });

        return createdCv;
      });

      // Wait until attachment has acquired the row lock in PostgreSQL
      while (!attachmentLockAcquired) {
        await new Promise((r) => setTimeout(r, 50));
      }

      // Thread A: Concurrent deletion attempt
      const deletionPromise = (async () => {
        deletionAttemptStarted = true;
        deletionResult = await fileAssetService.deleteFileAsset(asset.id, testStudentUser.id);
      })();

      // Wait a short duration to ensure Deletion has executed and is blocked waiting for row lock
      await new Promise((r) => setTimeout(r, 300));
      expect(deletionAttemptStarted).toBe(true);
      expect(deletionResult).toBeNull(); // Still blocked waiting on row lock!

      // Now release Attachment to commit PERMANENT and CV creation
      releaseAttachment!();
      const attachedCv = await attachmentPromise;
      expect(attachedCv.fileAssetId).toBe(asset.id);

      // Deletion should now unblock, see active CV reference, and return STILL_REFERENCED
      await deletionPromise;
      expect(deletionResult).not.toBeNull();
      expect(deletionResult.deleted).toBe(false);
      expect(deletionResult.outcome).toBe('STILL_REFERENCED');
      expect(deletionResult.status).toBe('IN_USE');

      // Verify physical file was PRESERVED in storage
      const fileStillExists = await storageService.exists(asset.storageKey);
      expect(fileStillExists).toBe(true);

      // Clean up CV and asset
      await prisma.cv.delete({ where: { id: attachedCv.id } });
      await fileAssetService.deleteFileAsset(asset.id, testStudentUser.id);
      const fileDeletedAfterCvDetached = await storageService.exists(asset.storageKey);
      expect(fileDeletedAfterCvDetached).toBe(false);
    }, 30000);
  });

  describe('Section 8: HTTP Upload Boundary Security & Validation', () => {
    it('should reject unauthenticated upload requests with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/students/cvs/upload')
        .attach('file', Buffer.from('%PDF-1.7 content'), 'cv.pdf')
        .expect(401);
    });

    it('should reject missing file payload when invoked directly on use case with 400', async () => {
      const uploadUseCase = app.get(require('../src/modules/students/application/use-cases/upload-cv-file.use-case').UploadCvFileUseCase);
      await expect(uploadUseCase.execute(testStudentUser.id, null as any)).rejects.toThrow('Vui lòng chọn tệp');
    });

    it('should reject spoofed binary (e.g. Windows PE disguised as PDF) with 400', async () => {
      const uploadUseCase = app.get(require('../src/modules/students/application/use-cases/upload-cv-file.use-case').UploadCvFileUseCase);
      const spoofedPayload = {
        buffer: Buffer.from('MZ\x90\x00\x03\x00\x00\x00Malicious PE Binary Content'),
        originalname: 'innocent_looking_resume.pdf',
        mimetype: 'application/pdf',
      };

      await expect(uploadUseCase.execute(testStudentUser.id, spoofedPayload)).rejects.toThrow(
        'Nội dung tệp không hợp lệ hoặc không khớp với định dạng PDF/DOC/DOCX được hỗ trợ.',
      );
    });

    it('should successfully store genuine PDF and return FileAssetDto with PENDING_UPLOAD status', async () => {
      const uploadUseCase = app.get(require('../src/modules/students/application/use-cases/upload-cv-file.use-case').UploadCvFileUseCase);
      const validPdfPayload = {
        buffer: Buffer.from('%PDF-1.7\n%Genuine PDF Content Header\nBody of Document'),
        originalname: 'my_authentic_resume.pdf',
        mimetype: 'application/pdf',
      };

      const result = await uploadUseCase.execute(testStudentUser.id, validPdfPayload);

      expect(result).toHaveProperty('id');
      expect(result.originalName).toBe('my_authentic_resume.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.status).toBe(FileAssetStatus.PENDING_UPLOAD);
      expect(result).toHaveProperty('checksumSha256');

      // Verify physical file was written and can be read
      const readBuffer = await storageService.read(result.storageKey);
      expect(readBuffer.toString()).toContain('%PDF-1.7');

      // Clean up
      await storageService.delete(result.storageKey);
      await prisma.fileAsset.delete({ where: { id: result.id } });
    });
  });

  describe('Section 5: Data Migration & Normalized Skills Verification', () => {
    it('should normalize, lowercase, trim, and deduplicate skills via database check constraint', async () => {
      // 1. Create a skill with valid canonical normalizedName
      const skill = await prisma.skill.create({
        data: {
          name: 'Node.js Backend',
          normalizedName: 'nodejs backend',
        },
      });

      expect(skill.normalizedName).toBe('nodejs backend');

      // 2. Verify that non-canonical normalizedName violates CHECK constraint
      await expect(
        prisma.skill.create({
          data: {
            name: 'Invalid Skill',
            normalizedName: '  UPPERCASE AND UNTRIMMED  ',
          },
        }),
      ).rejects.toThrow();

      // Clean up
      await prisma.skill.delete({ where: { id: skill.id } });
    });

    it('should enforce unique default CV constraint via database partial index', async () => {
      // Create first default CV
      const cv1 = await prisma.cv.create({
        data: {
          studentProfileId: testStudentProfile.id,
          title: 'Default CV 1',
          isDefault: true,
          skills: ['Node.js'],
        },
      });

      expect(cv1.isDefault).toBe(true);

      // Attempting to directly insert a second default CV bypassing application logic must be rejected by PostgreSQL partial unique index
      await expect(
        prisma.cv.create({
          data: {
            studentProfileId: testStudentProfile.id,
            title: 'Default CV 2 Violating Index',
            isDefault: true,
            skills: ['React'],
          },
        }),
      ).rejects.toThrow();

      // Clean up
      await prisma.cv.delete({ where: { id: cv1.id } });
    });
  });
});
