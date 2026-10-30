import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { FileAssetStatus, FileAssetResult } from '../src/shared/storage/file-asset.service';
import { IStorageService, STORAGE_SERVICE_TOKEN } from '../src/shared/storage/storage.interface';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';
import { UserRole, UserStatus, JobSeekingStatus } from '@campusjob/contracts';

const request = supertest;

describe('S3-M02-02: CV/FileAsset Lifecycle & Ownership Verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storageService: IStorageService;

  const defaultPassword = 'SecurePassword123!';

  // Users for E2E matrix
  const users = {
    studentA: {
      id: '',
      email: 's3-m02-student-a@campusjob.local',
      token: '',
      profileId: '',
    },
    studentB: {
      id: '',
      email: 's3-m02-student-b@campusjob.local',
      token: '',
      profileId: '',
    },
    employer: {
      id: '',
      email: 's3-m02-employer@campusjob.local',
      token: '',
    },
  };

  let uploadedFileAssetA: Pick<FileAssetResult, 'id' | 'storageKey'>;
  let uploadedFileAssetA2: Pick<FileAssetResult, 'id' | 'storageKey'>;
  let createdCvAId: string;
  let createdCvNoFileId: string;

  async function loginUser(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: defaultPassword })
      .expect(200);
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);
    storageService = app.get<IStorageService>(STORAGE_SERVICE_TOKEN);

    // Dọn dẹp dữ liệu cũ nếu có
    const emails = Object.values(users).map((u) => u.email);
    const existing = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const userIds = existing.map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.application.deleteMany({ where: { studentId: { in: userIds } } });
      const profiles = await prisma.studentProfile.findMany({ where: { userId: { in: userIds } } });
      const pIds = profiles.map((p) => p.id);
      await prisma.cv.deleteMany({ where: { studentProfileId: { in: pIds } } });
      await prisma.fileAsset.deleteMany({ where: { ownerUserId: { in: userIds } } });
      await prisma.studentSkill.deleteMany({ where: { studentProfileId: { in: pIds } } });
      await prisma.studentProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    // Tạo các tài khoản
    const passwordHash = await PasswordHasher.hash(defaultPassword);

    // Student A
    const userA = await prisma.user.create({
      data: {
        email: users.studentA.email,
        fullName: 'Nguyễn Văn Sinh Viên A',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    users.studentA.id = userA.id;
    const profileA = await prisma.studentProfile.create({
      data: {
        userId: userA.id,
        university: 'Đại học Bách Khoa TP.HCM',
        major: 'Khoa học Máy tính',
        graduationYear: 2026,
        jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
      },
    });
    users.studentA.profileId = profileA.id;

    // Student B
    const userB = await prisma.user.create({
      data: {
        email: users.studentB.email,
        fullName: 'Trần Thị Sinh Viên B',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    users.studentB.id = userB.id;
    const profileB = await prisma.studentProfile.create({
      data: {
        userId: userB.id,
        university: 'Đại học Khoa học Tự nhiên',
        major: 'Công nghệ Thông tin',
        graduationYear: 2026,
        jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
      },
    });
    users.studentB.profileId = profileB.id;

    // Employer
    const userEmp = await prisma.user.create({
      data: {
        email: users.employer.email,
        fullName: 'Lê Tuyển Dụng',
        role: UserRole.EMPLOYER,
        status: UserStatus.ACTIVE,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    users.employer.id = userEmp.id;

    // Login để lấy access token
    users.studentA.token = await loginUser(users.studentA.email);
    users.studentB.token = await loginUser(users.studentB.email);
    users.employer.token = await loginUser(users.employer.email);
  }, 45000);

  afterAll(async () => {
    try {
      const emails = Object.values(users).map((u) => u.email);
      const existing = await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true },
      });
      const userIds = existing.map((u) => u.id);
      if (userIds.length > 0) {
        await prisma.application.deleteMany({ where: { studentId: { in: userIds } } });
        const profiles = await prisma.studentProfile.findMany({ where: { userId: { in: userIds } } });
        const pIds = profiles.map((p) => p.id);
        await prisma.cv.deleteMany({ where: { studentProfileId: { in: pIds } } });
        await prisma.fileAsset.deleteMany({ where: { ownerUserId: { in: userIds } } });
        await prisma.studentSkill.deleteMany({ where: { studentProfileId: { in: pIds } } });
        await prisma.studentProfile.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } catch {}

    if (app) {
      await app.close();
    }
  });

  // ========================================================================
  // NHÓM 1: UPLOAD & BOUNDARY VALIDATION (LIFECYCLE-01, LIFECYCLE-02)
  // ========================================================================
  describe('Nhóm 1: Tải lên tệp tài liệu CV và kiểm tra tính hợp lệ', () => {
    it('LIFECYCLE-01: Sinh viên A tải lên tệp PDF chuẩn thành công (201, PENDING_UPLOAD)', async () => {
      const genuinePdfBuffer = Buffer.from(
        '%PDF-1.7 Authentic PDF Document for Student A CV\nBody content of CV PDF',
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/students/cvs/upload')
        .set('Authorization', `Bearer ${users.studentA.token}`)
        .attach('file', genuinePdfBuffer, 'student_a_resume.pdf')
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.ownerUserId).toBe(users.studentA.id);
      expect(res.body.originalName).toBe('student_a_resume.pdf');
      expect(res.body.mimeType).toBe('application/pdf');
      expect(res.body.status).toBe(FileAssetStatus.PENDING_UPLOAD);
      expect(res.body.storageKey).toBeDefined();

      uploadedFileAssetA = res.body;

      // Xác nhận tệp vật lý đã được lưu trên disk
      const existsOnDisk = await storageService.exists(res.body.storageKey);
      expect(existsOnDisk).toBe(true);
    });

    it('LIFECYCLE-02a: Chặn tải lên tệp giả mạo (Windows PE exe trá hình .pdf) với 400 Bad Request', async () => {
      const spoofedPeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00Malicious Executable');

      const res = await request(app.getHttpServer())
        .post('/api/v1/students/cvs/upload')
        .set('Authorization', `Bearer ${users.studentA.token}`)
        .attach('file', spoofedPeBuffer, 'malicious_cv.pdf')
        .expect(400);

      expect(res.body.message).toContain('không khớp với định dạng');
    });

    it('LIFECYCLE-02b: Chặn khách vãng lai chưa đăng nhập tải lên tệp với 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/students/cvs/upload')
        .attach('file', Buffer.from('%PDF-1.7 authentic content'), 'cv.pdf')
        .expect(401);
    });
  });

  // ========================================================================
  // NHÓM 2: LIÊN KẾT CV–FILEASSET & ANTI-IDOR (LIFECYCLE-03, LIFECYCLE-04)
  // ========================================================================
  describe('Nhóm 2: Liên kết CV–FileAsset & Xác thực quyền sở hữu (Anti-IDOR)', () => {
    it('LIFECYCLE-04: Sinh viên B cố ý tạo CV bằng fileAssetId của Sinh viên A -> bị chặn 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${users.studentB.token}`)
        .send({
          title: 'CV Hacker Sinh Viên B',
          fileAssetId: uploadedFileAssetA.id,
          skills: ['Hacking'],
        })
        .expect(403);

      expect(res.body.message).toContain('không có quyền sử dụng hoặc liên kết');

      // Đảm bảo không có CV nào được tạo cho Sinh viên B
      const cvCount = await prisma.cv.count({
        where: { studentProfileId: users.studentB.profileId },
      });
      expect(cvCount).toBe(0);
    });

    it('LIFECYCLE-03: Sinh viên A tạo CV gắn fileAssetId hợp lệ -> thành công, FileAsset chuyển sang PERMANENT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${users.studentA.token}`)
        .send({
          title: 'CV Kỹ sư Backend - Sinh viên A',
          summary: 'Đam mê NestJS và kiến trúc phân tán',
          fileAssetId: uploadedFileAssetA.id,
          skills: ['TypeScript', 'NestJS', 'PostgreSQL'],
        })
        .expect(201);

      expect(res.body.cv).toBeDefined();
      expect(res.body.cv.fileAssetId).toBe(uploadedFileAssetA.id);
      createdCvAId = res.body.cv.id;

      // Xác nhận trong cơ sở dữ liệu: status của FileAsset được promote thành PERMANENT
      const dbAsset = await prisma.fileAsset.findUnique({
        where: { id: uploadedFileAssetA.id },
      });
      expect(dbAsset).not.toBeNull();
      expect(dbAsset!.status).toBe(FileAssetStatus.PERMANENT);
    });

    it('Tạo thêm 1 CV không kèm file cho Sinh viên A để test download CV không file', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${users.studentA.token}`)
        .send({
          title: 'CV Thiết kế Frontend - Sinh viên A',
          summary: 'Không đính kèm tệp PDF',
          skills: ['React', 'CSS'],
        })
        .expect(201);

      expect(res.body.cv.fileAssetId).toBeNull();
      createdCvNoFileId = res.body.cv.id;
    });
  });

  // ========================================================================
  // NHÓM 3: XEM DANH SÁCH & CHI TIẾT (LIFECYCLE-05)
  // ========================================================================
  describe('Nhóm 3: Danh sách và chi tiết CV bảo toàn thông tin tệp liên kết', () => {
    it('LIFECYCLE-05a: GET /api/v1/students/cvs trả về danh sách kèm trường fileAssetId', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${users.studentA.token}`)
        .expect(200);

      expect(res.body.total).toBe(2);
      const cvWithFile = res.body.data.find((c: { id: string; fileAssetId: string | null }) => c.id === createdCvAId);
      expect(cvWithFile).toBeDefined();
      expect(cvWithFile.fileAssetId).toBe(uploadedFileAssetA.id);

      const cvWithoutFile = res.body.data.find((c: { id: string; fileAssetId: string | null }) => c.id === createdCvNoFileId);
      expect(cvWithoutFile).toBeDefined();
      expect(cvWithoutFile.fileAssetId).toBeNull();
    });

    it('LIFECYCLE-05b: GET /api/v1/students/cvs/:id trả về chi tiết kèm trường fileAssetId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/cvs/${createdCvAId}`)
        .set('Authorization', `Bearer ${users.studentA.token}`)
        .expect(200);

      expect(res.body.cv.fileAssetId).toBe(uploadedFileAssetA.id);
    });
  });

  // ========================================================================
  // NHÓM 4: TẢI XUỐNG TỆP CV & BẢO VỆ RIÊNG TƯ (LIFECYCLE-06, 07, 08)
  // ========================================================================
  describe('Nhóm 4: Tải xuống tệp tài liệu CV và kiểm soát quyền sở hữu', () => {
    it('LIFECYCLE-06: Sinh viên A tải xuống tệp CV của mình thành công (200 OK, đúng MIME & Binary)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/cvs/${createdCvAId}/download`)
        .set('Authorization', `Bearer ${users.studentA.token}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('student_a_resume.pdf');
      expect(res.body.toString()).toContain('%PDF-1.7 Authentic PDF Document');
    });

    it('LIFECYCLE-07: Sinh viên B cố ý tải tệp CV của Sinh viên A -> bị chặn 404 (Anti-IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/cvs/${createdCvAId}/download`)
        .set('Authorization', `Bearer ${users.studentB.token}`)
        .expect(404);

      expect(res.body.message).toContain('Không tìm thấy CV');
    });

    it('LIFECYCLE-08: Tải xuống CV không có tệp tài liệu đính kèm -> trả về 404 Not Found', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/cvs/${createdCvNoFileId}/download`)
        .set('Authorization', `Bearer ${users.studentA.token}`)
        .expect(404);

      expect(res.body.message).toContain('không có tệp tài liệu đính kèm');
    });
  });

  // ========================================================================
  // NHÓM 5: THAY THẾ TỆP & DỌN DẸP AN TOÀN (LIFECYCLE-09)
  // ========================================================================
  describe('Nhóm 5: Cập nhật thay thế tệp CV và dọn dẹp tệp cũ', () => {
    it('LIFECYCLE-09: Cập nhật CV với tệp mới -> tệp mới thành PERMANENT, tệp cũ được xóa khỏi storage', async () => {
      // 1. Tải lên tệp mới
      const newPdfBuffer = Buffer.from('%PDF-1.7 Newly Updated Resume Content v2');
      const uploadRes = await request(app.getHttpServer())
        .post('/api/v1/students/cvs/upload')
        .set('Authorization', `Bearer ${users.studentA.token}`)
        .attach('file', newPdfBuffer, 'student_a_resume_v2.pdf')
        .expect(201);

      uploadedFileAssetA2 = uploadRes.body;

      const oldStorageKey = uploadedFileAssetA.storageKey;
      const newStorageKey = uploadedFileAssetA2.storageKey;

      // 2. Cập nhật CV để gắn tệp mới
      await request(app.getHttpServer())
        .patch(`/api/v1/students/cvs/${createdCvAId}`)
        .set('Authorization', `Bearer ${users.studentA.token}`)
        .send({
          fileAssetId: uploadedFileAssetA2.id,
        })
        .expect(200);

      // 3. Khẳng định: Tệp mới đã thành PERMANENT
      const newAssetInDb = await prisma.fileAsset.findUnique({
        where: { id: uploadedFileAssetA2.id },
      });
      expect(newAssetInDb!.status).toBe(FileAssetStatus.PERMANENT);

      // 4. Khẳng định: Tệp cũ đã bị xóa sạch khỏi DB và khỏi storage vật lý (không để lại file rác mồ côi)
      const oldAssetInDb = await prisma.fileAsset.findUnique({
        where: { id: uploadedFileAssetA.id },
      });
      expect(oldAssetInDb).toBeNull();

      const oldFileStillOnDisk = await storageService.exists(oldStorageKey);
      expect(oldFileStillOnDisk).toBe(false);

      const newFileOnDisk = await storageService.exists(newStorageKey);
      expect(newFileOnDisk).toBe(true);
    });
  });

  // ========================================================================
  // NHÓM 6: RÀNG BUỘC APPLICATION & XÓA CV (LIFECYCLE-10, LIFECYCLE-11)
  // ========================================================================
  describe('Nhóm 6: Ràng buộc hồ sơ ứng tuyển (Application) và xóa CV an toàn', () => {
    const testJobId = 'job-lifecycle-test-1';

    it('LIFECYCLE-10: Từ chối xóa CV đang được sử dụng trong hồ sơ ứng tuyển hoạt động (409 Conflict)', async () => {
      // 1. Giả lập đơn ứng tuyển của Sinh viên A sử dụng createdCvAId
      const appRecord = await prisma.application.create({
        data: {
          studentId: users.studentA.id,
          jobId: testJobId,
          cvId: createdCvAId,
          cvSnapshot: {
            snapshotId: 'snapshot-lifecycle-test',
            title: 'CV Kỹ sư Backend - Sinh viên A',
            fileAssetId: uploadedFileAssetA2.id,
          },
          status: 'SUBMITTED',
        },
      });

      // 2. Sinh viên A cố ý xóa CV đang gắn với đơn ứng tuyển hoạt động
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/students/cvs/${createdCvAId}`)
        .set('Authorization', `Bearer ${users.studentA.token}`)
        .expect(409);

      expect(res.body.message).toContain('đang được sử dụng trong hồ sơ ứng tuyển');

      // 3. Khẳng định: CV và FileAsset vẫn nguyên vẹn
      const cvStillExists = await prisma.cv.findUnique({ where: { id: createdCvAId } });
      expect(cvStillExists).not.toBeNull();

      const assetStillExists = await prisma.fileAsset.findUnique({ where: { id: uploadedFileAssetA2.id } });
      expect(assetStillExists).not.toBeNull();

      // Dọn dẹp đơn ứng tuyển để chuyển sang test tiếp theo
      await prisma.application.delete({ where: { id: appRecord.id } });
    });

    it('LIFECYCLE-11: Khi không còn ràng buộc bởi Application, xóa CV thành công và dọn dẹp sạch FileAsset & storage', async () => {
      const storageKey = uploadedFileAssetA2.storageKey;

      // 1. Sinh viên A xóa CV
      await request(app.getHttpServer())
        .delete(`/api/v1/students/cvs/${createdCvAId}`)
        .set('Authorization', `Bearer ${users.studentA.token}`)
        .expect(200);

      // 2. Khẳng định: CV đã bị xóa khỏi database
      const cvInDb = await prisma.cv.findUnique({ where: { id: createdCvAId } });
      expect(cvInDb).toBeNull();

      // 3. Khẳng định: FileAsset metadata đã bị xóa
      const assetInDb = await prisma.fileAsset.findUnique({ where: { id: uploadedFileAssetA2.id } });
      expect(assetInDb).toBeNull();

      // 4. Khẳng định: File vật lý đã bị xóa khỏi disk storage
      const fileOnDisk = await storageService.exists(storageKey);
      expect(fileOnDisk).toBe(false);
    });
  });
});
