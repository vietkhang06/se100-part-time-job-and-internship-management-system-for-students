import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ModerationTargetType, UserRole, UserStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/configure-app';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('Admin account management through AppModule', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const marker = randomUUID();
  const ids = { admin: randomUUID(), student: randomUUID(), employer: randomUUID(), pending: randomUUID() };
  const moderationItemId = randomUUID();
  const password = 'CampusJob1!';
  const api = '/api/v1';
  const users = api + '/admin/users';
  const status = (id: string) => users + '/' + id + '/status';
  const moderator = (id: string) => users + '/' + id + '/moderator';
  const auth = (accessToken: string) => ({ Authorization: 'Bearer ' + accessToken });
  const http = () => request(app.getHttpServer());

  async function login(account: keyof typeof ids, expected = 200) {
    return http().post(api + '/auth/login').send({ email: email(account), password }).expect(expected);
  }

  function email(account: string) {
    return marker + '-' + account + '@example.test';
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const passwordHash = await PasswordHasher.hash(password);

    await prisma.user.createMany({ data: [
      [ids.admin, 'admin', UserRole.ADMIN],
      [ids.student, 'student', UserRole.STUDENT],
      [ids.employer, 'employer', UserRole.EMPLOYER],
      [ids.pending, 'pending', UserRole.STUDENT],
    ].map(([id, account, role]) => ({
      id,
      email: email(account),
      fullName: marker + ' ' + account,
      passwordHash,
      role: role as UserRole,
      status: account === 'pending' ? UserStatus.PENDING_VERIFICATION : UserStatus.ACTIVE,
    })) });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.notification.deleteMany({ where: { recipientId: ids.employer } });
      await prisma.moderationItem.deleteMany({ where: { id: moderationItemId } });
      await prisma.auditLog.deleteMany({ where: { actorId: ids.admin } });
      await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
    }
    await app?.close();
  });

  it('limits reads to Admin, validates queries and returns only the account allowlist', async () => {
    const admin = auth((await login('admin')).body.accessToken);
    const student = auth((await login('student')).body.accessToken);
    await http().get(users).expect(401);
    await http().get(users).set(student).expect(403);
    await http().get(users + '/' + ids.student).set(student).expect(403);
    await http().get(users).set(admin).query({ pageSize: 101 }).expect(400);

    const list = await http().get(users).set(admin).query({
      search: marker.toUpperCase(), role: UserRole.STUDENT, status: UserStatus.ACTIVE, pageSize: 1,
    }).expect(200);
    expect(list.body).toMatchObject({ total: 1, page: 1, pageSize: 1, items: [{ id: ids.student }] });
    const detail = await http().get(users + '/' + ids.student).set(admin).expect(200);
    expect(Object.keys(detail.body).sort()).toEqual([
      'createdAt', 'email', 'emailVerifiedAt', 'fullName', 'id', 'role', 'status', 'updatedAt',
    ]);
    await http().get(users + '/' + randomUUID()).set(admin).expect(404);
  });

  it('updates account status, invalidates sessions and records exactly one audit row per change', async () => {
    const admin = auth((await login('admin')).body.accessToken);
    const original = await login('student');
    const student = auth(original.body.accessToken);
    const cookie = (original.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

    await http().patch(status(ids.student)).set(student).send({ status: 'LOCKED' }).expect(403);
    await http().patch(status(ids.admin)).set(admin).send({ status: 'LOCKED' }).expect(403);
    await http().patch(status(ids.pending)).set(admin).send({ status: 'ACTIVE' }).expect(409);
    await http().patch(status(ids.student)).set(admin).send({ status: 'ACTIVE', role: 'ADMIN' }).expect(400);

    await Promise.all(Array.from({ length: 2 }, () =>
      http().patch(status(ids.student)).set(admin).send({ status: 'SUSPENDED' }).expect(200),
    ));
    const suspended = await login('student', 403);
    expect(suspended.body.code).toBe('ACCOUNT_SUSPENDED');
    await http().get(api + '/auth/me').set(student).expect(403);
    await http().post(api + '/auth/refresh').set('Cookie', cookie).expect(401);

    await http().patch(status(ids.student)).set(admin).send({ status: 'ACTIVE' }).expect(200);
    await http().get(api + '/auth/me').set(student).expect(401);
    const newStudent = auth((await login('student')).body.accessToken);
    await http().get(api + '/auth/me').set(newStudent).expect(200);
    await http().patch(status(ids.student)).set(admin).send({ status: 'LOCKED' }).expect(200);
    await http().patch(status(ids.student)).set(admin).send({ status: 'ACTIVE' }).expect(409);
    expect((await login('student', 403)).body.code).toBe('ACCOUNT_LOCKED');

    const audit = await prisma.auditLog.findMany({
      where: { entityId: ids.student }, orderBy: { createdAt: 'asc' },
    });
    expect(audit.map(({ actorId, action, entityType, entityId, metadata }) =>
      ({ actorId, action, entityType, entityId, metadata }))).toEqual(
      [['ACTIVE', 'SUSPENDED'], ['SUSPENDED', 'ACTIVE'], ['ACTIVE', 'LOCKED']].map(
        ([fromStatus, toStatus]) => ({
          actorId: ids.admin, action: 'USER_STATUS_CHANGED', entityType: 'USER',
          entityId: ids.student, metadata: { fromStatus, toStatus },
        }),
      ),
    );
    expect(audit.every((event) => event.createdAt instanceof Date)).toBe(true);
  });

  it('grants and revokes moderator on real M05 routes, preserving the original role and audit', async () => {
    const admin = auth((await login('admin')).body.accessToken);
    const employer = auth((await login('employer')).body.accessToken);
    const queue = api + '/moderation/queue';
    await http().get(queue).expect(401);
    await http().get(queue).set(employer).expect(403);
    await http().patch(moderator(ids.employer)).set(employer).send({ enabled: true }).expect(403);
    await http().patch(moderator(ids.employer)).set(admin).send({ enabled: true, role: 'ADMIN' }).expect(400);
    expect((await http().patch(moderator(ids.employer)).set(admin).send({ enabled: true }).expect(200)).body.role)
      .toBe(UserRole.MODERATOR);
    await http().get(queue).set(employer).expect(200);
    await http().get(users).set(employer).expect(403);

    await prisma.moderationItem.create({
      data: { id: moderationItemId, targetId: randomUUID(), targetType: ModerationTargetType.JOB },
    });
    const claim = api + '/moderation/items/' + moderationItemId + '/claim';
    await http().post(claim).set(employer).expect(200);
    await http().patch(moderator(ids.employer)).set(admin).send({ enabled: false }).expect(409);
    await http().post(claim).set(admin).expect(200);
    expect((await http().patch(moderator(ids.employer)).set(admin).send({ enabled: false }).expect(200)).body.role)
      .toBe(UserRole.EMPLOYER);
    await http().get(queue).set(employer).expect(403);
    await http().post(claim).set(employer).expect(403);
    const audit = await prisma.auditLog.findMany({ where: { entityId: ids.employer } });
    expect(audit).toHaveLength(2);
    expect(audit).toEqual(expect.arrayContaining([
      expect.objectContaining({ actorId: ids.admin, action: 'MODERATOR_ROLE_GRANTED', metadata: { fromRole: 'EMPLOYER', toRole: 'MODERATOR' } }),
      expect.objectContaining({ actorId: ids.admin, action: 'MODERATOR_ROLE_REVOKED', metadata: { fromRole: 'MODERATOR', toRole: 'EMPLOYER' } }),
    ]));
  });

  it('enforces notification ownership and derives user identity from AuthContext', async () => {
    const employer = auth((await login('employer')).body.accessToken);
    const admin = auth((await login('admin')).body.accessToken);
    const notification = await prisma.notification.create({
      data: { recipientId: ids.employer, eventType: 'REPORT_RECEIVED', title: 'Test', body: 'Ownership' },
    });
    const route = api + '/notifications/' + notification.id + '/read';
    await http().patch(route).expect(401);
    await http().patch(route).set(admin).expect(404);
    await http().get(api + '/notifications').set(admin).query({ userId: ids.employer }).expect(400);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: notification.id } })).readAt).toBeNull();
    await http().patch(route).set(employer).expect(200);
  });
});
