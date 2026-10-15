import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';
import {
  AuthErrorCode,
  CvErrorCode,
  StudentProfileErrorCode,
  UserRole,
  UserStatus,
  JobSeekingStatus,
} from '@campusjob/contracts';
import { M04Workflow } from '../src/modules/applications/application/m04-workflow';
import { PrismaM04Repository } from '../src/modules/applications/infrastructure/prisma-m04.repository';
import { JobAccessSource, M04WorkflowError } from '../src/modules/applications/application/m04-ports';
import { CV_SNAPSHOT_SOURCE_TOKEN } from '../src/modules/students/infrastructure/adapters/cv-snapshot-source.adapter';
import { GetCvSnapshotUseCase } from '../src/modules/students/application/use-cases/get-cv-snapshot.use-case';

const request = (typeof supertest === 'function' ? supertest : (supertest as any).default) as typeof supertest;

describe('S2-M02-06: M02 Integration Tests (UC11–UC12, UC31–UC35, UC37–UC38)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let m04Workflow: M04Workflow;

  const defaultPassword = 'SecurePassword123!@#';

  interface TestAccount {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    token: string;
    profileId?: string;
    cv1Id?: string;
    cv2Id?: string;
    cvId?: string;
  }

  const accounts: Record<string, TestAccount> = {
    studentA: {
      id: '',
      email: 'm02-int-student-a@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      token: '',
      profileId: '',
      cv1Id: '',
      cv2Id: '',
    },
    studentB: {
      id: '',
      email: 'm02-int-student-b@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      token: '',
      profileId: '',
      cvId: '',
    },
    employer: {
      id: '',
      email: 'm02-int-employer@campusjob.local',
      role: UserRole.EMPLOYER,
      status: UserStatus.ACTIVE,
      token: '',
    },
    moderator: {
      id: '',
      email: 'm02-int-moderator@campusjob.local',
      role: UserRole.MODERATOR,
      status: UserStatus.ACTIVE,
      token: '',
    },
    admin: {
      id: '',
      email: 'm02-int-admin@campusjob.local',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      token: '',
    },
    suspendedStudent: {
      id: '',
      email: 'm02-int-suspended@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.SUSPENDED,
      token: '',
      profileId: '',
    },
    lockedStudent: {
      id: '',
      email: 'm02-int-locked@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.LOCKED,
      token: '',
      profileId: '',
    },
  };

  const testJobId = 'm02-int-job-id-999';
  let createdApplicationId = '';

  const stubJobAccessSource: JobAccessSource = {
    async assertAcceptingApplications(jobId: string): Promise<void> {
      if (jobId === testJobId) return;
      throw new M04WorkflowError('NOT_FOUND');
    },
    async assertManagedBy(): Promise<void> {
      return;
    },
  };

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

    // Dọn dẹp dữ liệu cũ nếu có
    const allEmails = Object.values(accounts).map((a) => a.email);
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: allEmails } },
      select: { id: true },
    });
    const userIds = existingUsers.map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.application.deleteMany({ where: { studentId: { in: userIds } } });
      const profiles = await prisma.studentProfile.findMany({ where: { userId: { in: userIds } } });
      const profileIds = profiles.map((p) => p.id);
      await prisma.cv.deleteMany({ where: { studentProfileId: { in: profileIds } } });
      await prisma.studentProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    // Khởi tạo các tài khoản người dùng mẫu
    const passwordHash = await PasswordHasher.hash(defaultPassword);
    for (const [key, acc] of Object.entries(accounts)) {
      const user = await prisma.user.create({
        data: {
          email: acc.email,
          fullName: `User ${key}`,
          role: acc.role,
          status: acc.status,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      });
      acc.id = user.id;

      if (acc.role === UserRole.STUDENT) {
        const profile = await prisma.studentProfile.create({
          data: {
            userId: user.id,
            university: 'Đại học Bách Khoa TP.HCM',
            major: 'Khoa học Máy tính',
            graduationYear: 2026,
            jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
            skills: ['TypeScript', 'NestJS'],
          },
        });
        acc.profileId = profile.id;
      }
    }

    // Lấy access token cho các tài khoản hợp lệ
    accounts.studentA.token = await loginUser(accounts.studentA.email);
    accounts.studentB.token = await loginUser(accounts.studentB.email);
    accounts.employer.token = await loginUser(accounts.employer.email);
    accounts.moderator.token = await loginUser(accounts.moderator.email);
    accounts.admin.token = await loginUser(accounts.admin.email);

    // For suspended & locked users, issue tokens by temporarily setting ACTIVE, logging in, then reverting
    await prisma.user.update({ where: { id: accounts.suspendedStudent.id }, data: { status: UserStatus.ACTIVE } });
    accounts.suspendedStudent.token = await loginUser(accounts.suspendedStudent.email);
    await prisma.user.update({ where: { id: accounts.suspendedStudent.id }, data: { status: UserStatus.SUSPENDED } });

    await prisma.user.update({ where: { id: accounts.lockedStudent.id }, data: { status: UserStatus.ACTIVE } });
    accounts.lockedStudent.token = await loginUser(accounts.lockedStudent.email);
    await prisma.user.update({ where: { id: accounts.lockedStudent.id }, data: { status: UserStatus.LOCKED } });

    // Khởi tạo M04Workflow với real CvSnapshotSource adapter từ M02
    const cvSnapshotSource = app.get<GetCvSnapshotUseCase>(CV_SNAPSHOT_SOURCE_TOKEN);
    const m04Repo = new PrismaM04Repository(prisma);
    m04Workflow = new M04Workflow(m04Repo, cvSnapshotSource, stubJobAccessSource);
  }, 60000);

  afterAll(async () => {
    const allEmails = Object.values(accounts).map((a) => a.email);
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: allEmails } },
      select: { id: true },
    });
    const userIds = existingUsers.map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.application.deleteMany({ where: { studentId: { in: userIds } } });
      const profiles = await prisma.studentProfile.findMany({ where: { userId: { in: userIds } } });
      const profileIds = profiles.map((p) => p.id);
      await prisma.cv.deleteMany({ where: { studentProfileId: { in: profileIds } } });
      await prisma.studentProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app.close();
  });

  // ==========================================================================
  // NHÓM 1: XÁC THỰC & PHÂN QUYỀN RBAC (INT-01 ĐẾN INT-06)
  // ==========================================================================
  describe('Nhóm 1: Xác thực & Phân quyền RBAC (C-01, C-02, C-04)', () => {
    it('INT-01: Chặn khách vãng lai chưa đăng nhập truy cập CV list (401 UNAUTHORIZED)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/cvs')
        .expect(401);
      expect(res.body.code).toBe(AuthErrorCode.UNAUTHORIZED);
    });

    it('INT-02: Chặn Employer truy cập trực tiếp danh sách CV sinh viên (403 FORBIDDEN)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.employer.token}`)
        .expect(403);
      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('INT-03: Chặn Moderator truy cập danh sách CV sinh viên (403 FORBIDDEN)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.moderator.token}`)
        .expect(403);
      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('INT-04: Chặn Admin truy cập danh sách CV sinh viên (403 FORBIDDEN)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.admin.token}`)
        .expect(403);
      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('INT-05: Chặn tài khoản sinh viên bị đình chỉ SUSPENDED (403 ACCOUNT_SUSPENDED)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.suspendedStudent.token}`)
        .expect(403);
      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_SUSPENDED);
    });

    it('INT-06: Chặn tài khoản sinh viên bị khóa LOCKED (403 ACCOUNT_LOCKED)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.lockedStudent.token}`)
        .send({ bio: 'Hack bio' })
        .expect(403);
      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
    });
  });

  // ==========================================================================
  // NHÓM 2: TOÀN VẸN AUTH CONTEXT & HỒ SƠ SINH VIÊN (INT-07)
  // ==========================================================================
  describe('Nhóm 2: Toàn vẹn Auth Context & Hồ sơ sinh viên (UC11, UC12, C-01, C-05)', () => {
    it('INT-07: Lấy và cập nhật đúng hồ sơ của sinh viên đang đăng nhập', async () => {
      // 1. Lấy thông tin Profile
      const getRes = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .expect(200);

      expect(getRes.body.profile).toBeDefined();
      expect(getRes.body.profile.userId).toBe(accounts.studentA.id);
      expect(getRes.body.profile.email).toBe(accounts.studentA.email);

      // 2. Cập nhật Profile
      const patchRes = await request(app.getHttpServer())
        .patch('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .send({
          bio: 'Kỹ sư phần mềm tương lai chuyên về NestJS và Clean Architecture',
          skills: ['NestJS', 'PostgreSQL', 'Docker'],
          jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
        })
        .expect(200);

      expect(patchRes.body.profile.bio).toContain('Kỹ sư phần mềm tương lai');
      expect(patchRes.body.profile.skills).toEqual(['NestJS', 'PostgreSQL', 'Docker']);
    });
  });

  // ==========================================================================
  // NHÓM 3: QUẢN LÝ CV, QUYỀN SỞ HỮU & CHỐNG IDOR (INT-08 ĐẾN INT-14)
  // ==========================================================================
  describe('Nhóm 3: Quản lý CV, Quyền sở hữu & Chống IDOR (UC31–UC35, C-05)', () => {
    it('INT-08: Sinh viên A tạo CV đầu tiên thành công và tự động nhận isDefault: true', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .send({
          title: 'CV Backend Engineer - Student A',
          summary: 'Kinh nghiệm lập trình TypeScript và NestJS',
          skills: ['TypeScript', 'NestJS', 'PostgreSQL'],
          educations: [
            {
              school: 'ĐH Bách Khoa',
              major: 'CNTT',
              startDate: '2021-09',
              endDate: '2025-06',
              gpa: '3.6',
            },
          ],
        })
        .expect(201);

      expect(res.body.cv).toBeDefined();
      expect(res.body.cv.id).toBeDefined();
      expect(res.body.cv.isDefault).toBe(true);
      expect(res.body.cv.studentId).toBe(accounts.studentA.profileId);
      accounts.studentA.cv1Id = res.body.cv.id;

      // Đồng thời sinh viên B cũng tạo 1 CV riêng của B
      const resB = await request(app.getHttpServer())
        .post('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .send({
          title: 'CV Frontend Developer - Student B',
          skills: ['React', 'Next.js'],
        })
        .expect(201);
      accounts.studentB.cvId = resB.body.cv.id;
    });

    it('INT-09: UC31 - Sinh viên A chỉ thấy đúng CV của mình, không thấy CV của Sinh viên B', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      const cvIds = res.body.data.map((cv: any) => cv.id);
      expect(cvIds).toContain(accounts.studentA.cv1Id);
      expect(cvIds).not.toContain(accounts.studentB.cvId);
    });

    it('INT-10: Anti-IDOR (Xem) - Sinh viên B cố xem chi tiết CV của Sinh viên A bị chặn 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/cvs/${accounts.studentA.cv1Id}`)
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .expect(404);

      expect(res.body.code).toBe(CvErrorCode.CV_NOT_FOUND);
    });

    it('INT-11: Anti-IDOR (Sửa) - Sinh viên B cố chỉnh sửa CV của Sinh viên A bị chặn 404', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/students/cvs/${accounts.studentA.cv1Id}`)
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .send({ title: 'Hacked Title' })
        .expect(404);

      expect(res.body.code).toBe(CvErrorCode.CV_NOT_FOUND);
    });

    it('INT-12: Anti-IDOR (Default) - Sinh viên B cố đổi cờ default CV của Sinh viên A bị chặn 404', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/students/cvs/${accounts.studentA.cv1Id}/default`)
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .send({ isDefault: true })
        .expect(404);

      expect(res.body.code).toBe(CvErrorCode.CV_NOT_FOUND);
    });

    it('INT-13: Anti-IDOR (Xóa) - Sinh viên B cố xóa CV của Sinh viên A bị chặn 404', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/students/cvs/${accounts.studentA.cv1Id}`)
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .expect(404);

      expect(res.body.code).toBe(CvErrorCode.CV_NOT_FOUND);
    });

    it('INT-14: Anti-IDOR (Snapshot) - Sinh viên B cố lấy snapshot CV của Sinh viên A bị chặn 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/cvs/${accounts.studentA.cv1Id}/snapshot`)
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .expect(404);

      expect(res.body.code).toBe(CvErrorCode.CV_NOT_FOUND);
    });
  });

  // ==========================================================================
  // NHÓM 4: QUY TẮC NGHIỆP VỤ QUẢN LÝ CV (INT-15 ĐẾN INT-16)
  // ==========================================================================
  describe('Nhóm 4: Quy tắc nghiệp vụ Quản lý CV (C-04 Business Rules)', () => {
    it('INT-15: Chuyển cờ mặc định sang CV thứ hai tự động bỏ cờ mặc định của CV đầu tiên', async () => {
      // 1. Tạo CV thứ hai
      const resCreate = await request(app.getHttpServer())
        .post('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .send({
          title: 'CV Fullstack Dev - Student A (CV2)',
          skills: ['Node.js', 'React'],
        })
        .expect(201);
      accounts.studentA.cv2Id = resCreate.body.cv.id;

      // 2. Đặt CV2 làm mặc định
      await request(app.getHttpServer())
        .patch(`/api/v1/students/cvs/${accounts.studentA.cv2Id}/default`)
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .send({ isDefault: true })
        .expect(200);

      // 3. Kiểm tra danh sách: CV2 là default: true, CV1 là default: false
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .expect(200);

      const cv1 = listRes.body.data.find((c: any) => c.id === accounts.studentA.cv1Id);
      const cv2 = listRes.body.data.find((c: any) => c.id === accounts.studentA.cv2Id);
      expect(cv1.isDefault).toBe(false);
      expect(cv2.isDefault).toBe(true);
    });

    it('INT-16: Chặn tạo quá giới hạn tối đa 10 CV trên cùng một sinh viên (400 CV_LIMIT_EXCEEDED)', async () => {
      // Đã có 2 CV, tạo thêm 8 CV nữa để đạt 10
      for (let i = 3; i <= 10; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/students/cvs')
          .set('Authorization', `Bearer ${accounts.studentA.token}`)
          .send({ title: `CV Thử nghiệm số ${i}` })
          .expect(201);
      }

      // Tạo CV thứ 11 phải bị chặn
      const res = await request(app.getHttpServer())
        .post('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .send({ title: 'CV thứ 11 vượt giới hạn' })
        .expect(400);

      expect(res.body.code).toBe(CvErrorCode.CV_LIMIT_EXCEEDED);
    });
  });

  // ==========================================================================
  // NHÓM 5: LUỒNG TÍCH HỢP M02 → M04 VÀ TÍNH BẤT BIẾN SNAPSHOT (INT-17 ĐẾN INT-20)
  // ==========================================================================
  describe('Nhóm 5: Luồng tích hợp M02 → M04 & Tính bất biến Snapshot (C-03, UC37, UC38)', () => {
    it('INT-17: M04 nộp đơn thành công khi tiêu thụ CvSnapshotSource từ M02', async () => {
      // Sinh viên A nộp đơn ứng tuyển với cv1Id
      const application = await m04Workflow.submit(
        accounts.studentA.profileId!,
        testJobId,
        accounts.studentA.cv1Id!,
        'Em xin nộp đơn ứng tuyển vị trí Backend Intern',
      );

      expect(application).toBeDefined();
      expect(application.id).toBeDefined();
      expect(application.studentId).toBe(accounts.studentA.profileId);
      expect(application.cvId).toBe(accounts.studentA.cv1Id);

      // Snapshot được M04 lưu giữ trong PostgreSQL
      expect(application.cvSnapshot).toBeDefined();
      expect(application.cvSnapshot.originalCvId).toBe(accounts.studentA.cv1Id);
      expect(application.cvSnapshot.title).toBe('CV Backend Engineer - Student A');
      expect(application.cvSnapshot.skills).toContain('NestJS');
      expect(application.cvSnapshot.capturedAt).toBeDefined();

      createdApplicationId = application.id;
    });

    it('INT-18: M04 từ chối khi sinh viên A cố nộp đơn bằng cvId của sinh viên B (Chống IDOR)', async () => {
      // Sinh viên A truyền cvId của sinh viên B
      await expect(
        m04Workflow.submit(
          accounts.studentA.profileId!,
          testJobId,
          accounts.studentB.cvId!,
          'Nộp đơn bằng CV người khác',
        ),
      ).rejects.toThrow();
    });

    it('INT-19: UC37 - Tính bất biến: Sinh viên A cập nhật CV gốc trên M02 nhưng snapshot trong đơn M04 không đổi', async () => {
      // 1. Sinh viên A cập nhật CV gốc (thay đổi title và skills)
      await request(app.getHttpServer())
        .patch(`/api/v1/students/cvs/${accounts.studentA.cv1Id}`)
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .send({
          title: 'CV AI & Data Engineer (Đã đổi ngành hoàn toàn)',
          skills: ['Python', 'PyTorch', 'TensorFlow'],
        })
        .expect(200);

      // 2. M04 truy vấn lại chi tiết đơn ứng tuyển của sinh viên A (UC37)
      const appRecord = await m04Workflow.getMine(accounts.studentA.profileId!, createdApplicationId);

      // 3. Khẳng định: Snapshot trong hồ sơ vẫn mang giá trị ban đầu tại thời điểm nộp đơn
      expect(appRecord.cvSnapshot.title).toBe('CV Backend Engineer - Student A');
      expect(appRecord.cvSnapshot.skills).toContain('NestJS');
      expect(appRecord.cvSnapshot.skills).not.toContain('PyTorch');
    });

    it('INT-20: UC37 - Tính bất biến: Đơn ứng tuyển trong M04 vẫn toàn vẹn sau khi CV gốc bị xóa', async () => {
      // 1. Sinh viên xóa CV2 (đã tạo ở bước INT-15)
      await request(app.getHttpServer())
        .delete(`/api/v1/students/cvs/${accounts.studentA.cv2Id}`)
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .expect(200);

      // 2. Đơn ứng tuyển ban đầu gắn với cv1Id vẫn đọc được toàn bộ snapshot bình thường
      const appRecord = await m04Workflow.getMine(accounts.studentA.profileId!, createdApplicationId);
      expect(appRecord).toBeDefined();
      expect(appRecord.cvSnapshot.title).toBe('CV Backend Engineer - Student A');
      expect(appRecord.cvSnapshot.originalCvId).toBe(accounts.studentA.cv1Id);
    });
  });
});
