import { PrismaClient, CompanyMemberRole, CompanyMemberStatus, CompanyVerificationStatus, JobStatus, JobType, UserRole, UserStatus } from '@prisma/client';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';

const raw = process.env.M04_TEST_DATABASE_URL;
if (!raw) throw new Error('M04_TEST_DATABASE_URL is required.');
const target = new URL(raw);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/campusjob_m04_test') {
  throw new Error('Browser fixture only supports the local campusjob_m04_test database.');
}
process.env.DATABASE_URL = raw;

const prisma = new PrismaClient();
const ids = {
  student: '10000000-0000-4000-8000-000000000001',
  hr: '10000000-0000-4000-8000-000000000002',
  company: '10000000-0000-4000-8000-000000000003',
  branch: '10000000-0000-4000-8000-000000000004',
  job: '10000000-0000-4000-8000-000000000005',
  cv: '10000000-0000-4000-8000-000000000006',
};

async function cleanup() {
  await prisma.m04EventOutbox.deleteMany({ where: { OR: [{ actorId: { in: [ids.student, ids.hr] } }, { recipientId: { in: [ids.student, ids.hr] } }] } });
  await prisma.notification.deleteMany({ where: { recipientId: { in: [ids.student, ids.hr] } } });
  await prisma.application.deleteMany({ where: { OR: [{ studentId: ids.student }, { jobId: ids.job }] } });
  await prisma.jobPosting.deleteMany({ where: { id: ids.job } });
  await prisma.company.deleteMany({ where: { id: ids.company } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.student, ids.hr] } } });
}

async function seed() {
  await cleanup();
  const passwordHash = await PasswordHasher.hash('CampusJob1!');
  await prisma.user.createMany({ data: [
    { id: ids.student, email: 'm04-browser-student@example.test', fullName: 'Browser Student', passwordHash, role: UserRole.STUDENT, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
    { id: ids.hr, email: 'm04-browser-hr@example.test', fullName: 'Browser HR', passwordHash, role: UserRole.EMPLOYER, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
  ] });
  const profile = await prisma.studentProfile.create({ data: { userId: ids.student, university: 'UIT', major: 'Software Engineering' } });
  await prisma.cv.create({ data: { id: ids.cv, studentProfileId: profile.id, title: 'Browser CV', summary: 'CV for browser smoke', skills: ['TypeScript', 'NestJS'], isDefault: true } });
  await prisma.company.create({ data: { id: ids.company, name: 'Browser Test Company', taxId: 'M04-BROWSER-TEST', verificationStatus: CompanyVerificationStatus.VERIFIED } });
  await prisma.companyMember.create({ data: { companyId: ids.company, userId: ids.hr, role: CompanyMemberRole.OWNER, status: CompanyMemberStatus.ACTIVE } });
  await prisma.companyBranch.create({ data: { id: ids.branch, companyId: ids.company, branchName: 'Browser HQ', addressLine: '1 Test Road', city: 'Ho Chi Minh City' } });
  await prisma.jobPosting.create({ data: { id: ids.job, companyId: ids.company, branchId: ids.branch, title: 'M04 Browser Test Job', description: 'Browser smoke fixture', industry: 'Software', type: JobType.INTERNSHIP, skills: ['TypeScript'], quantity: 1, deadline: new Date('2035-12-31T00:00:00.000Z'), status: JobStatus.OPEN } });
}

const action = process.argv[2];
(action === 'seed' ? seed() : action === 'cleanup' ? cleanup() : Promise.reject(new Error('Use seed or cleanup.')))
  .finally(() => prisma.$disconnect());
