import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CompanyMemberRole, CompanyMemberStatus, CompanyVerificationStatus,
  JobStatus, JobType, UserRole, UserStatus,
} from '@prisma/client';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/configure-app';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('S6-M04-01 production AppModule E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `m04-e2e-${randomUUID()}`;
  const password = 'CampusJob1!';
  const ids = { student: randomUUID(), otherStudent: randomUUID(), hr: randomUUID(), otherHr: randomUUID() };
  const jobIds: string[] = [];
  let cvId: string;
  let otherCvId: string;
  let primaryJobId: string;
  const ineligibleJobIds: string[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const waitFor = async (condition: () => Promise<boolean>, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    while (!(await condition())) {
      if (Date.now() >= deadline) throw new Error('Timed out waiting for persisted side effect.');
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  const login = async (email: string) => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email, password }).expect(200);
    return response.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await PasswordHasher.hash(password);
    await prisma.user.createMany({ data: [
      { id: ids.student, email: `${tag}-student@example.test`, fullName: 'M04 Student', passwordHash, role: UserRole.STUDENT, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
      { id: ids.otherStudent, email: `${tag}-student-2@example.test`, fullName: 'Other Student', passwordHash, role: UserRole.STUDENT, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
      { id: ids.hr, email: `${tag}-hr@example.test`, fullName: 'M04 HR', passwordHash, role: UserRole.EMPLOYER, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
      { id: ids.otherHr, email: `${tag}-hr-2@example.test`, fullName: 'Other HR', passwordHash, role: UserRole.EMPLOYER, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
    ] });
    const studentProfile = await prisma.studentProfile.create({ data: { userId: ids.student, university: 'UIT' } });
    const otherProfile = await prisma.studentProfile.create({ data: { userId: ids.otherStudent, university: 'UIT' } });
    cvId = randomUUID(); otherCvId = randomUUID();
    await prisma.cv.createMany({ data: [
      { id: cvId, studentProfileId: studentProfile.id, title: 'Original CV', summary: 'Snapshot source', skills: ['TypeScript', 'NestJS'] },
      { id: otherCvId, studentProfileId: otherProfile.id, title: 'Other CV', skills: ['Java'] },
    ] });

    const company = await prisma.company.create({ data: { name: `${tag} Company`, taxId: `${tag}-tax`, verificationStatus: CompanyVerificationStatus.VERIFIED } });
    const otherCompany = await prisma.company.create({ data: { name: `${tag} Other Company`, taxId: `${tag}-tax-2`, verificationStatus: CompanyVerificationStatus.VERIFIED } });
    const unverifiedCompany = await prisma.company.create({ data: { name: `${tag} Unverified Company`, taxId: `${tag}-tax-3`, verificationStatus: CompanyVerificationStatus.PENDING_REVIEW } });
    await prisma.companyMember.createMany({ data: [
      { companyId: company.id, userId: ids.hr, role: CompanyMemberRole.OWNER, status: CompanyMemberStatus.ACTIVE },
      { companyId: otherCompany.id, userId: ids.otherHr, role: CompanyMemberRole.OWNER, status: CompanyMemberStatus.ACTIVE },
    ] });
    const branch = await prisma.companyBranch.create({ data: { companyId: company.id, branchName: 'HQ', addressLine: '1 Test Road', city: 'Ho Chi Minh City' } });
    const otherBranch = await prisma.companyBranch.create({ data: { companyId: otherCompany.id, branchName: 'HQ', addressLine: '2 Test Road', city: 'Ho Chi Minh City' } });
    const unverifiedBranch = await prisma.companyBranch.create({ data: { companyId: unverifiedCompany.id, branchName: 'HQ', addressLine: '3 Test Road', city: 'Ho Chi Minh City' } });
    primaryJobId = randomUUID();
    const baseJob = { description: 'Production M04 E2E fixture', industry: 'Software', type: JobType.INTERNSHIP,
      skills: ['TypeScript'], quantity: 1, deadline: new Date('2035-12-31T00:00:00.000Z'), status: JobStatus.OPEN };
    const jobs = [
      { id: primaryJobId, companyId: company.id, branchId: branch.id, title: 'Primary E2E Job', ...baseJob },
      ...Array.from({ length: 6 }, (_, index) => ({ id: randomUUID(), companyId: company.id, branchId: branch.id, title: `Quota Job ${index + 1}`, ...baseJob })),
      { id: randomUUID(), companyId: otherCompany.id, branchId: otherBranch.id, title: 'Other Company Job', ...baseJob },
      { id: randomUUID(), companyId: company.id, branchId: branch.id, title: 'Pending Job', ...baseJob, status: JobStatus.PENDING_APPROVAL },
      { id: randomUUID(), companyId: company.id, branchId: branch.id, title: 'Paused Job', ...baseJob, status: JobStatus.PAUSED },
      { id: randomUUID(), companyId: company.id, branchId: branch.id, title: 'Closed Job', ...baseJob, status: JobStatus.CLOSED },
      { id: randomUUID(), companyId: company.id, branchId: branch.id, title: 'Expired Job', ...baseJob, deadline: new Date('2020-01-01T00:00:00.000Z') },
      { id: randomUUID(), companyId: unverifiedCompany.id, branchId: unverifiedBranch.id, title: 'Unverified Company Job', ...baseJob },
    ];
    ineligibleJobIds.push(...jobs.slice(-5).map((job) => job.id));
    jobIds.push(...jobs.map((job) => job.id));
    await prisma.jobPosting.createMany({ data: jobs });
  });

  afterAll(async () => {
    await prisma.m04EventOutbox.deleteMany({ where: { OR: [
      { actorId: { in: Object.values(ids) } }, { recipientId: { in: Object.values(ids) } },
    ] } });
    await prisma.notification.deleteMany({ where: { recipientId: { in: Object.values(ids) } } });
    await prisma.application.deleteMany({ where: { OR: [{ studentId: { in: [ids.student, ids.otherStudent] } }, { jobId: { in: jobIds } }] } });
    await prisma.jobPosting.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.company.deleteMany({ where: { taxId: { startsWith: tag } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await app.close();
  });

  it('runs submit → review → interview → reschedule → result through real adapters and M05', async () => {
    const [studentToken, otherStudentToken, hrToken, otherHrToken] = await Promise.all([
      login(`${tag}-student@example.test`), login(`${tag}-student-2@example.test`),
      login(`${tag}-hr@example.test`), login(`${tag}-hr-2@example.test`),
    ]);

    await request(app.getHttpServer()).post(`/api/v1/jobs/${primaryJobId}/apply`).send({ cvId }).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/jobs/${primaryJobId}/apply`)
      .set(auth(hrToken)).send({ cvId }).expect(403);
    await request(app.getHttpServer()).post(`/api/v1/jobs/${primaryJobId}/apply`)
      .set(auth(studentToken)).send({ cvId, studentId: ids.otherStudent }).expect(400);
    await request(app.getHttpServer()).post(`/api/v1/jobs/${primaryJobId}/apply`)
      .set(auth(studentToken)).send({ cvId: otherCvId }).expect(404);

    const submitted = await request(app.getHttpServer()).post(`/api/v1/jobs/${primaryJobId}/apply`)
      .set(auth(studentToken)).send({ cvId, coverLetter: 'Production E2E' }).expect(201);
    const applicationId = submitted.body.id as string;
    await prisma.cv.update({ where: { id: cvId }, data: { title: 'Changed source CV' } });

    const detail = await request(app.getHttpServer()).get(`/api/v1/applications/me/${applicationId}`)
      .set(auth(studentToken)).expect(200);
    expect(detail.body.cvSnapshot.title).toBe('Original CV');
    await request(app.getHttpServer()).get(`/api/v1/applications/me/${applicationId}`)
      .set(auth(otherStudentToken)).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/employer/applications/${applicationId}`)
      .set(auth(otherHrToken)).expect(403);

    await request(app.getHttpServer()).patch(`/api/v1/employer/applications/${applicationId}/viewed`)
      .set(auth(hrToken)).expect(200);
    await request(app.getHttpServer()).post(`/api/v1/employer/applications/${applicationId}/interviews`)
      .set(auth(hrToken)).send({ scheduledAt: '2020-01-01T10:00:00+07:00', mode: 'ONLINE', locationOrLink: 'https://example.test/room' }).expect(409);
    expect(await prisma.interview.count({ where: { applicationId } })).toBe(0);

    const invited = await request(app.getHttpServer()).post(`/api/v1/employer/applications/${applicationId}/interviews`)
      .set(auth(hrToken)).send({ scheduledAt: '2035-06-10T10:00:00+07:00', mode: 'ONLINE', locationOrLink: 'https://example.test/room' }).expect(201);
    const interviewId = invited.body.id as string;
    await request(app.getHttpServer()).post(`/api/v1/interviews/${interviewId}/confirm`).set(auth(otherStudentToken)).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/interviews/${interviewId}/confirm`).set(auth(studentToken)).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/interviews/${interviewId}/change-request`)
      .set(auth(studentToken)).send({ proposedAt: '2035-06-11T10:00:00+07:00', message: 'Need another day' }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/interviews/${interviewId}/change-request`)
      .set(auth(studentToken)).send({ proposedAt: '2035-06-12T10:00:00+07:00' }).expect(409);
    await request(app.getHttpServer()).patch(`/api/v1/employer/interviews/${interviewId}/change-request`)
      .set(auth(hrToken)).send({ decision: 'APPROVED' }).expect(200);

    await prisma.interview.update({ where: { id: interviewId }, data: { scheduledAt: new Date('2026-01-01T00:00:00.000Z') } });
    await request(app.getHttpServer()).patch(`/api/v1/employer/interviews/${interviewId}/result`)
      .set(auth(hrToken)).send({ result: 'ACCEPTED' }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/employer/interviews/${interviewId}/result`)
      .set(auth(hrToken)).send({ result: 'REJECTED', reason: 'duplicate' }).expect(409);

    const stored = await prisma.application.findUniqueOrThrow({ where: { id: applicationId }, include: { statusHistory: true } });
    expect(stored.status).toBe('ACCEPTED');
    expect(stored.statusHistory.map((item) => item.toStatus)).toEqual(['SUBMITTED', 'REVIEWING', 'INTERVIEW_SCHEDULED', 'ACCEPTED']);
    await waitFor(async () => await prisma.jobCloseSuggestion.count({ where: { jobId: primaryJobId } }) === 1);
    await waitFor(async () => await prisma.notification.count({
      where: { recipientId: { in: [ids.student, ids.hr] } },
    }) >= 5);
    expect(await prisma.jobCloseSuggestion.count({ where: { jobId: primaryJobId } })).toBe(1);
    expect((await prisma.jobPosting.findUniqueOrThrow({ where: { id: primaryJobId } })).status).toBe(JobStatus.OPEN);
    expect(await prisma.notification.count({ where: { recipientId: ids.otherHr } })).toBe(0);
    expect(await prisma.notification.count({ where: { recipientId: { in: [ids.student, ids.hr] } } })).toBeGreaterThanOrEqual(5);
    expect(await prisma.m04EventOutbox.count({ where: { actorId: { in: [ids.student, ids.hr] }, publishedAt: null } })).toBe(0);

    await request(app.getHttpServer()).post(`/api/v1/jobs/${primaryJobId}/apply`)
      .set(auth(studentToken)).send({ cvId }).expect(409);
  });

  it('rejects every ineligible production job/company without persistence side effects', async () => {
    const studentToken = await login(`${tag}-student-2@example.test`);
    for (const jobId of ineligibleJobIds) {
      await request(app.getHttpServer()).post(`/api/v1/jobs/${jobId}/apply`)
        .set(auth(studentToken)).send({ cvId: otherCvId }).expect(409);
    }
    expect(await prisma.application.count({ where: {
      studentId: ids.otherStudent, jobId: { in: ineligibleJobIds },
    } })).toBe(0);
    expect(await prisma.applicationStatusHistory.count({ where: {
      application: { studentId: ids.otherStudent, jobId: { in: ineligibleJobIds } },
    } })).toBe(0);
  });

  it('holds the five-active-application quota under concurrent HTTP requests', async () => {
    const studentToken = await login(`${tag}-student@example.test`);
    const quotaJobs = jobIds.slice(1, 7);
    for (const jobId of quotaJobs.slice(0, 4)) {
      await request(app.getHttpServer()).post(`/api/v1/jobs/${jobId}/apply`).set(auth(studentToken)).send({ cvId }).expect(201);
    }
    const responses = await Promise.all(quotaJobs.slice(4).map((jobId) =>
      request(app.getHttpServer()).post(`/api/v1/jobs/${jobId}/apply`).set(auth(studentToken)).send({ cvId }),
    ));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.application.count({ where: {
      studentId: ids.student, status: { in: ['SUBMITTED', 'REVIEWING', 'INTERVIEW_SCHEDULED'] },
    } })).toBe(5);
  });
});
