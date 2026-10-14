/**
 * [W1-QA-01] E2E Auth: luồng đúng (happy path) và luồng lỗi (error path).
 *
 * File này khác `auth.e2e-spec.ts` ở chỗ:
 *  - Luồng đúng chạy liền mạch từ đầu đến cuối, chỉ gọi qua HTTP:
 *      đăng ký -> nhận email -> xác minh (lấy token từ email) ->
 *      đăng nhập -> /me -> refresh -> logout.
 *    Không chèn dữ liệu giả vào DB để "đi tắt" (DB chỉ được đọc để kiểm tra kết quả).
 *  - Email được bắt lại bằng cách thay phần gửi SMTP của NodemailerMailService thật,
 *    nên vẫn kiểm tra được tiêu đề, link và token trong email mà không cần Mailpit/SMTP.
 *  - Mỗi nhóm test dùng user riêng (email không trùng), nên không phụ thuộc thứ tự
 *    giữa các nhóm và không đụng các file e2e khác.
 *
 * Cần PostgreSQL thật (xem docs/TEST_PLAN.md). Chạy: `pnpm test:e2e`.
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';
import { UserRole, UserStatus } from '@campusjob/contracts';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { GlobalExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { MAIL_SERVICE_TOKEN } from '../src/shared/mail/mail.service.interface';
import { TokenUtils } from '../src/modules/auth/infrastructure/security/token.utils';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';

const request = (typeof supertest === 'function'
  ? supertest
  : (supertest as any).default) as typeof supertest;

jest.setTimeout(60_000);

// ---------------------------------------------------------------------------
// Test environment
// ---------------------------------------------------------------------------
const TEST_DOMAIN = 'e2e-flow.campusjob.local';
const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PASSWORD = 'SuperSecret123!@#';
const WRONG_PASSWORD = 'WrongPassword123!';
const API = '/api/v1/auth';

const uniqueEmail = (label: string) => `${label}-${RUN_ID}@${TEST_DOMAIN}`;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface SentMail {
  from?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface ParsedCookie {
  name: string;
  value: string;
  raw: string;
}

describe('Auth flow (e2e): happy path & error paths', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let webUrl: string;
  let cookieName: string;
  let jwtSecret: string;

  /** Every email the API "sent" during this run 
   * (captured instead of going over SMTP). */
  const outbox: SentMail[] = [];

  // -------------------------------------------------------------------------
  // Bootstrap / teardown
  // -------------------------------------------------------------------------
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    // Must mirror src/main.ts, otherwise we would not be testing the real HTTP behaviour.
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService, { strict: false });

    const config = app.get(ConfigService);
    webUrl = config.get<string>('WEB_URL', 'http://localhost:3000');
    cookieName = config.get<string>('COOKIE_NAME') || 'campusjob_refresh_token';
    jwtSecret = config.get<string>('JWT_ACCESS_SECRET', 'replace_with_long_random_access_secret');

    // Capture outgoing mail: keep the real NodemailerMailService (subject/link/token
    // building) and only replace the network transport.
    const mailService = app.get(MAIL_SERVICE_TOKEN, { strict: false }) as object;
    expect(mailService).toHaveProperty('transporter'); // fails loudly if the service is refactored
    (mailService as any).transporter = {
      sendMail: async (options: SentMail) => {
        outbox.push({ ...options });
        return { messageId: `e2e-${outbox.length}` };
      },
    };

    await cleanup();
  });

  afterAll(async () => {
    if (prisma) await cleanup();
    if (app) await app.close();
  });

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: `@${TEST_DOMAIN}` } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return;
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    // Sessions / verification tokens / reset tokens are removed by ON DELETE CASCADE.
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const http = () => request(app.getHttpServer());

  const registerBody = (email: string, overrides: Record<string, unknown> = {}) => ({
    email,
    password: PASSWORD,
    fullName: 'E2E Flow User',
    role: UserRole.STUDENT,
    ...overrides,
  });

  const register = (email: string, overrides: Record<string, unknown> = {}) =>
    http().post(`${API}/register`).send(registerBody(email, overrides));

  const verifyEmail = (token: unknown) => http().post(`${API}/verify-email`).send({ token });

  const resend = (email: string) => http().post(`${API}/resend-verification`).send({ email });

  const login = (email: string, password: string = PASSWORD) =>
    http().post(`${API}/login`).send({ email, password });

  const refresh = (cookie?: ParsedCookie | string) => {
    const req = http().post(`${API}/refresh`);
    if (cookie) req.set('Cookie', typeof cookie === 'string' ? cookie : cookieHeader(cookie));
    return req;
  };

  const logout = (cookie?: ParsedCookie | string) => {
    const req = http().post(`${API}/logout`);
    if (cookie) req.set('Cookie', typeof cookie === 'string' ? cookie : cookieHeader(cookie));
    return req;
  };

  const me = (accessToken?: string, scheme = 'Bearer') => {
    const req = http().get(`${API}/me`);
    if (accessToken) req.set('Authorization', `${scheme} ${accessToken}`);
    return req;
  };

  function setCookieHeaders(res: supertest.Response): string[] {
    const raw = res.headers['set-cookie'] as unknown as string[] | string | undefined;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  function findCookie(res: supertest.Response, name: string): ParsedCookie | undefined {
    for (const raw of setCookieHeaders(res)) {
      const pair = raw.split(';')[0];
      const idx = pair.indexOf('=');
      if (pair.slice(0, idx).trim() === name) {
        return { name, value: pair.slice(idx + 1).trim(), raw };
      }
    }
    return undefined;
  }

  const cookieHeader = (cookie: ParsedCookie) => `${cookie.name}=${cookie.value}`;

  function mailsTo(email: string): SentMail[] {
    return outbox.filter((m) => m.to.toLowerCase() === email.toLowerCase());
  }

  /** Extracts the verification link + token from an email, the way a user's browser would. */
  function parseVerificationMail(mail: SentMail): { link: string; url: URL; token: string } {
    const match = /https?:\/\/\S+/.exec(mail.text ?? '');
    if (!match) throw new Error(`No link found in email text: ${mail.text}`);
    const link = match[0];
    const url = new URL(link);
    const token = url.searchParams.get('token');
    if (!token) throw new Error(`No token in verification link: ${link}`);
    return { link, url, token };
  }

  /** Registers a user and returns the token from the email that was "delivered". */
  async function registerAndGetToken(email: string) {
    const res = await register(email).expect(201);
    const mails = mailsTo(email);
    expect(mails).toHaveLength(1);
    const { token } = parseVerificationMail(mails[0]);
    return { res, userId: res.body.user.id as string, token };
  }

  /** register -> email -> verify, entirely through the public API. */
  async function createVerifiedUser(label: string) {
    const email = uniqueEmail(label);
    const { userId, token } = await registerAndGetToken(email);
    await verifyEmail(token).expect(200);
    return { email, userId };
  }

  async function loginAs(email: string) {
    const res = await login(email).expect(200);
    const cookie = findCookie(res, cookieName);
    if (!cookie) throw new Error('Login did not set the refresh cookie');
    return {
      res,
      accessToken: res.body.accessToken as string,
      userId: res.body.user.id as string,
      cookie,
    };
  }

  const activeSessionCount = (userId: string) =>
    prisma.authSession.count({ where: { userId, revokedAt: null } });

  const totalSessionCount = (userId: string) => prisma.authSession.count({ where: { userId } });

  /** Contract of the global exception filter (ApiErrorResponse). */
  function expectApiError(res: supertest.Response, status: number, messagePattern?: RegExp) {
    expect(res.status).toBe(status);
    expect(res.body).toMatchObject({
      statusCode: status,
      error: expect.any(String),
      timestamp: expect.any(String),
      path: expect.stringContaining(API),
    });
    expect(res.body.message).toBeDefined();
    if (messagePattern) {
      const text = Array.isArray(res.body.message) ? res.body.message.join(' ') : res.body.message;
      expect(text).toMatch(messagePattern);
    }
  }

  const b64url = (input: string) => Buffer.from(input).toString('base64url');
  const decodeJwtPayload = (token: string): Record<string, unknown> =>
    JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

  // =========================================================================
  // 1. HAPPY PATH — one continuous journey
  // =========================================================================
  describe('Happy path: register -> email -> verify -> login -> refresh -> logout', () => {
    const email = uniqueEmail('journey');
    const state: {
      userId: string;
      verificationToken: string;
      accessToken: string;
      cookie?: ParsedCookie;
      refreshedCookie?: ParsedCookie;
      refreshedAccessToken: string;
    } = { userId: '', verificationToken: '', accessToken: '', refreshedAccessToken: '' };

    it('1. registers the account as PENDING_VERIFICATION without leaking secrets', async () => {
      const res = await register(email, { phone: '0912345678' }).expect(201);

      expect(res.body.message).toBeDefined();
      expect(res.body.user).toMatchObject({
        email,
        role: UserRole.STUDENT,
        status: UserStatus.PENDING_VERIFICATION,
        emailVerified: false,
      });
      expect(res.body.user.id).toEqual(expect.any(String));
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.accessToken).toBeUndefined();
      expect(findCookie(res, cookieName)).toBeUndefined(); // registering must not log the user in
      state.userId = res.body.user.id;

      const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: state.userId } });
      expect(dbUser.passwordHash).not.toBe(PASSWORD);
      expect(await PasswordHasher.verify(dbUser.passwordHash, PASSWORD)).toBe(true);
      expect(dbUser.emailVerifiedAt).toBeNull();
    });

    it('2. delivers exactly one verification email whose link carries the token', async () => {
      const mails = mailsTo(email);
      expect(mails).toHaveLength(1);

      const mail = mails[0];
      expect(mail.subject).toMatch(/xác thực/i);

      const { link, url, token } = parseVerificationMail(mail);
      expect(url.origin).toBe(new URL(webUrl).origin);
      expect(url.pathname).toBe('/verify-email');
      expect(url.searchParams.get('email')).toBe(email);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(mail.html).toContain(link); // the HTML body links to the very same URL
      state.verificationToken = token;

      // Only the hash is stored; the raw token exists only in the email.
      const stored = await prisma.emailVerificationToken.findMany({ where: { userId: state.userId } });
      expect(stored).toHaveLength(1);
      expect(stored[0].tokenHash).toBe(TokenUtils.hashToken(token));
      expect(stored[0].tokenHash).not.toBe(token);
      expect(stored[0].usedAt).toBeNull();
      expect(stored[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('3. refuses login (403) while the email is still unverified', async () => {
      const res = await login(email);

      expectApiError(res, 403, /xác minh/i);
      expect(findCookie(res, cookieName)).toBeUndefined();
      expect(res.body.accessToken).toBeUndefined();
      expect(await totalSessionCount(state.userId)).toBe(0);
    });

    it('4. verifies the email using the token from the email and activates the account', async () => {
      const res = await verifyEmail(state.verificationToken).expect(200);
      expect(res.body.email).toBe(email);

      const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: state.userId } });
      expect(dbUser.status).toBe(UserStatus.ACTIVE);
      expect(dbUser.emailVerifiedAt).not.toBeNull();

      const tokenRow = await prisma.emailVerificationToken.findUniqueOrThrow({
        where: { tokenHash: TokenUtils.hashToken(state.verificationToken) },
      });
      expect(tokenRow.usedAt).not.toBeNull();
    });

    it('5. does not accept the same verification link a second time', async () => {
      const res = await verifyEmail(state.verificationToken);
      expectApiError(res, 400, /already been used/i);
    });

    it('6. logs in: returns an access token and sets an HttpOnly refresh cookie', async () => {
      const res = await login(email).expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toBeUndefined(); // refresh token is cookie-only, never in the body
      expect(res.body.user).toMatchObject({
        id: state.userId,
        email,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);

      const cookie = findCookie(res, cookieName);
      expect(cookie).toBeDefined();
      expect(cookie!.value.length).toBeGreaterThan(20);
      expect(cookie!.raw).toMatch(/HttpOnly/i);
      expect(cookie!.raw).toMatch(/SameSite=Lax/i);
      expect(cookie!.raw).toMatch(/Path=\/api\/v1\/auth/);

      // The DB stores only the hash of the refresh token.
      const session = await prisma.authSession.findFirstOrThrow({
        where: { tokenHash: TokenUtils.hashToken(cookie!.value) },
      });
      expect(session.userId).toBe(state.userId);
      expect(session.revokedAt).toBeNull();

      state.accessToken = res.body.accessToken;
      state.cookie = cookie;
    });

    it('7. GET /me returns the logged-in user for the issued access token', async () => {
      const res = await me(state.accessToken).expect(200);
      expect(res.body.user).toMatchObject({ id: state.userId, email, role: UserRole.STUDENT });
    });

    it('8. refreshes: rotates the refresh token (same family) and issues a new access token', async () => {
      const res = await refresh(state.cookie).expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.accessToken).not.toBe(state.accessToken);
      expect(res.body.user.id).toBe(state.userId);

      const newCookie = findCookie(res, cookieName);
      expect(newCookie).toBeDefined();
      expect(newCookie!.value).not.toBe(state.cookie!.value);
      expect(newCookie!.raw).toMatch(/HttpOnly/i);

      const oldSession = await prisma.authSession.findFirstOrThrow({
        where: { tokenHash: TokenUtils.hashToken(state.cookie!.value) },
      });
      const newSession = await prisma.authSession.findFirstOrThrow({
        where: { tokenHash: TokenUtils.hashToken(newCookie!.value) },
      });
      expect(oldSession.revokedAt).not.toBeNull();
      expect(newSession.revokedAt).toBeNull();
      expect(newSession.tokenFamily).toBe(oldSession.tokenFamily);

      // The new access token really works.
      await me(res.body.accessToken).expect(200);

      state.refreshedAccessToken = res.body.accessToken;
      state.refreshedCookie = newCookie;
    });

    it('9. logs out: revokes the session, clears the cookie, refresh no longer works', async () => {
      const res = await logout(state.refreshedCookie).expect(200);
      expect(res.body.ok).toBe(true);

      const cleared = findCookie(res, cookieName);
      expect(cleared).toBeDefined();
      expect(cleared!.value).toBe('');
      expect(cleared!.raw).toMatch(/Expires=Thu, 01 Jan 1970/i);

      expect(await activeSessionCount(state.userId)).toBe(0);

      const afterLogout = await refresh(state.refreshedCookie);
      expectApiError(afterLogout, 401);
      expect(findCookie(afterLogout, cookieName)?.value ?? '').not.toBe(state.refreshedCookie!.value);
    });

    it('10. can log in again after logout (a fresh session is created)', async () => {
      const again = await loginAs(email);
      expect(again.cookie.value).not.toBe(state.refreshedCookie!.value);
      expect(await activeSessionCount(state.userId)).toBe(1);
    });

    // Known gap, intentionally not asserted either way: JwtStrategy does not check the
    // session behind an access token, so it stays valid until it expires (default 15m).
    it.todo('rejects an access token whose session was revoked by logout (needs sessionId check in JwtStrategy)');
  });

  // =========================================================================
  // 2. REGISTER — duplicate email & validation
  // =========================================================================
  describe('Register: duplicate email and invalid input', () => {
    let verifiedEmail: string;
    let pendingEmail: string;

    beforeAll(async () => {
      verifiedEmail = (await createVerifiedUser('dup-verified')).email;
      pendingEmail = uniqueEmail('dup-pending');
      await registerAndGetToken(pendingEmail);
    });

    it.each([
      ['verified account, identical email', () => verifiedEmail],
      ['verified account, different casing', () => verifiedEmail.toUpperCase()],
      ['verified account, surrounding whitespace', () => `  ${verifiedEmail}  `],
      ['still-unverified account, identical email', () => pendingEmail],
    ])('rejects a duplicate email with 409 (%s)', async (_label, getEmail) => {
      const mailsBefore = outbox.length;

      const res = await register(getEmail(), { password: 'AnotherSecret456!@#', fullName: 'Attacker' });

      expectApiError(res, 409, /already registered/i);
      expect(outbox.length).toBe(mailsBefore); // no email is sent for a rejected registration
    });

    it('does not overwrite the existing account when a duplicate registration is attempted', async () => {
      await register(verifiedEmail, { password: 'AnotherSecret456!@#', fullName: 'Attacker' }).expect(409);

      expect(await prisma.user.count({ where: { email: verifiedEmail } })).toBe(1);
      await login(verifiedEmail, PASSWORD).expect(200); // original password still works
      await login(verifiedEmail, 'AnotherSecret456!@#').expect(401); // attacker's password does not
    });

    it('lets exactly one of two simultaneous registrations for the same email succeed', async () => {
      const email = uniqueEmail('dup-race');

      const [a, b] = await Promise.all([register(email), register(email)]);

      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await prisma.user.count({ where: { email } })).toBe(1);
      expect(mailsTo(email)).toHaveLength(1);
    });

    const invalidCases: Array<[string, Record<string, unknown>]> = [
      ['invalid email format', { email: 'not-an-email' }],
      ['password without special character', { password: 'weakpassword' }],
      ['password shorter than 8 characters', { password: 'Ab1!' }],
      ['password without uppercase letter', { password: 'lowercase123!@#' }],
      ['missing fullName', { fullName: undefined }],
      ['ADMIN role (privilege escalation)', { role: UserRole.ADMIN }],
      ['MODERATOR role (privilege escalation)', { role: UserRole.MODERATOR }],
      ['unknown role', { role: 'SUPERUSER' }],
      ['mass assignment: status=ACTIVE', { status: UserStatus.ACTIVE }],
      ['mass assignment: emailVerifiedAt', { emailVerifiedAt: new Date().toISOString() }],
    ];

    it.each(invalidCases)('rejects invalid registration with 400 (%s)', async (label, overrides) => {
      const slug = label.replace(/\W+/g, '-').slice(0, 30);
      const email = (overrides.email as string | undefined) ?? uniqueEmail(`invalid-${slug}`);
      const mailsBefore = outbox.length;

      const res = await register(email, overrides);

      expectApiError(res, 400);
      expect(await prisma.user.count({ where: { email: email.toLowerCase() } })).toBe(0);
      expect(outbox.length).toBe(mailsBefore);
    });
  });

  // =========================================================================
  // 3. VERIFY EMAIL — wrong / expired / replayed tokens, resend
  // =========================================================================
  describe('Verify email: wrong, expired and replaced tokens', () => {
    const badTokens: Array<[string, string, RegExp]> = [
      ['unknown token', 'f'.repeat(64), /invalid/i],
      ['random garbage', 'completely-non-existent-token', /invalid/i],
      ['empty string', '', /required/i],
      ['whitespace only', '   ', /required|invalid/i],
    ];

    it.each(badTokens)('rejects %s with 400', async (_label, token, pattern) => {
      expectApiError(await verifyEmail(token), 400, pattern);
    });

    const malformedTokens: Array<[string, unknown]> = [
      ['missing token field', undefined],
      ['non-string token', 12345],
      ['array token', ['a', 'b']],
    ];

    it.each(malformedTokens)('rejects a malformed body with 400 (%s)', async (_label, token) => {
      const res = await http().post(`${API}/verify-email`).send(token === undefined ? {} : { token });
      expectApiError(res, 400);
    });

    it('rejects a tampered / truncated copy of a real emailed token and keeps the real one usable', async () => {
      const email = uniqueEmail('verify-tampered');
      const { userId, token } = await registerAndGetToken(email);

      const flipped = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
      expectApiError(await verifyEmail(flipped), 400, /invalid/i);
      expectApiError(await verifyEmail(token.slice(0, 32)), 400, /invalid/i);
      expectApiError(await verifyEmail(token + 'ab'), 400, /invalid/i);

      // failed attempts did not burn the genuine token or activate the user
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).status).toBe(
        UserStatus.PENDING_VERIFICATION,
      );
      await verifyEmail(token).expect(200);
    });

    it('rejects an expired token, keeps the account locked out, then recovers via resend', async () => {
      const email = uniqueEmail('verify-expired');
      const { userId, token: expiredToken } = await registerAndGetToken(email);

      // The only thing we fast-forward is time: the 24h expiry of the genuinely emailed token.
      await prisma.emailVerificationToken.updateMany({
        where: { userId },
        data: { expiresAt: new Date(Date.now() - 60_000), createdAt: new Date(Date.now() - 61_000) },
      });

      expectApiError(await verifyEmail(expiredToken), 400, /expired/i);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user.status).toBe(UserStatus.PENDING_VERIFICATION);
      expect(user.emailVerifiedAt).toBeNull();
      expectApiError(await login(email), 403);

      // Recovery: request a new link (cooldown has passed because createdAt is > 60s old)
      await resend(email).expect(200);
      const mails = mailsTo(email);
      expect(mails).toHaveLength(2);
      const { token: newToken } = parseVerificationMail(mails[1]);
      expect(newToken).not.toBe(expiredToken);

      await verifyEmail(expiredToken).expect(400);
      await verifyEmail(newToken).expect(200);
      await login(email).expect(200);
    });

    it('invalidates the previous link when a new one is requested', async () => {
      const email = uniqueEmail('verify-resend');
      const { userId, token: firstToken } = await registerAndGetToken(email);

      await prisma.emailVerificationToken.updateMany({
        where: { userId },
        data: { createdAt: new Date(Date.now() - 61_000) }, // skip the 60s cooldown only
      });
      await resend(email).expect(200);
      const { token: secondToken } = parseVerificationMail(mailsTo(email)[1]);

      expectApiError(await verifyEmail(firstToken), 400, /already been used|no longer valid|invalid/i);
      await verifyEmail(secondToken).expect(200);
    });

    it('enforces the resend cooldown (429) and sends no extra email', async () => {
      const email = uniqueEmail('verify-cooldown');
      await registerAndGetToken(email);

      const res = await resend(email);

      expectApiError(res, 429, /wait/i);
      expect(mailsTo(email)).toHaveLength(1);
    });

    it('refuses to resend for an already verified account (400)', async () => {
      const { email } = await createVerifiedUser('verify-already');
      const mailsBefore = outbox.length;

      expectApiError(await resend(email), 400, /already been verified/i);
      expect(outbox.length).toBe(mailsBefore);
    });

    it('answers resend for an unknown email neutrally (no user enumeration) and sends nothing', async () => {
      const mailsBefore = outbox.length;

      const res = await resend(uniqueEmail('never-registered')).expect(200);

      expect(res.body.message).toMatch(/if your account is registered/i);
      expect(outbox.length).toBe(mailsBefore);
    });

    it('lets only one of two simultaneous verifications with the same emailed token succeed', async () => {
      const email = uniqueEmail('verify-race');
      const { token } = await registerAndGetToken(email);

      const [a, b] = await Promise.all([verifyEmail(token), verifyEmail(token)]);

      expect([a.status, b.status].sort()).toEqual([200, 400]);
    });
  });

  // =========================================================================
  // 4. LOGIN — wrong password and other credential errors
  // =========================================================================
  describe('Login: wrong credentials', () => {
    let user: { email: string; userId: string };

    beforeAll(async () => {
      user = await createVerifiedUser('login-errors');
    });

    it('rejects a wrong password with 401, sets no cookie and creates no session', async () => {
      const sessionsBefore = await totalSessionCount(user.userId);

      const res = await login(user.email, WRONG_PASSWORD);

      expectApiError(res, 401, /không chính xác/i);
      expect(res.body.accessToken).toBeUndefined();
      expect(findCookie(res, cookieName)).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain(WRONG_PASSWORD);
      expect(await totalSessionCount(user.userId)).toBe(sessionsBefore);
    });

    it('returns the same 401 message for wrong password and unknown email (no account enumeration)', async () => {
      const wrongPassword = await login(user.email, WRONG_PASSWORD);
      const unknownEmail = await login(uniqueEmail('ghost'), PASSWORD);

      expectApiError(unknownEmail, 401);
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });

    it('rejects the right password with different casing / near-miss (passwords are case-sensitive)', async () => {
      expectApiError(await login(user.email, PASSWORD.toUpperCase()), 401);
      expectApiError(await login(user.email, `${PASSWORD} `), 401);
    });

    it.each([
      ['missing password', { email: 'someone@example.com' }],
      ['empty password', { email: 'someone@example.com', password: '' }],
      ['missing email', { password: PASSWORD }],
      ['invalid email format', { email: 'not-an-email', password: PASSWORD }],
      ['non-string password', { email: 'someone@example.com', password: 12345 }],
      ['unexpected extra field', { email: 'someone@example.com', password: PASSWORD, role: 'ADMIN' }],
    ])('rejects a malformed login body with 400 (%s)', async (_label, body) => {
      expectApiError(await http().post(`${API}/login`).send(body), 400);
    });

    it('accepts the email case-insensitively', async () => {
      const res = await login(user.email.toUpperCase()).expect(200);
      expect(res.body.user.email).toBe(user.email);
    });
  });

  // =========================================================================
  // 5. ACCESS TOKEN — invalid / expired / forged
  // =========================================================================
  describe('Access token: invalid, expired and forged', () => {
    let user: { email: string; userId: string };
    let validAccessToken: string;

    beforeAll(async () => {
      user = await createVerifiedUser('access-token');
      validAccessToken = (await loginAs(user.email)).accessToken;
    });

    it('sanity check: the valid access token is accepted', async () => {
      await me(validAccessToken).expect(200);
    });

    it.each([
      ['GET', `${API}/me`],
      ['POST', `${API}/logout-all`],
    ])('rejects %s %s without credentials (401)', async (method, path) => {
      const res = await (method === 'GET' ? http().get(path) : http().post(path));
      expectApiError(res, 401);
    });

    it('rejects a garbage bearer token (401)', async () => {
      expectApiError(await me('not.a.jwt'), 401);
      expectApiError(await me('garbage'), 401);
    });

    it('rejects a valid token sent with the wrong scheme (401)', async () => {
      expectApiError(await me(validAccessToken, 'Basic'), 401);
      expectApiError(await me(validAccessToken, 'Token'), 401);
    });

    it('rejects a token whose payload was tampered with (role -> ADMIN) but keeps the old signature', async () => {
      const [header, , signature] = validAccessToken.split('.');
      const forgedPayload = b64url(JSON.stringify({ ...decodeJwtPayload(validAccessToken), role: UserRole.ADMIN }));

      expectApiError(await me(`${header}.${forgedPayload}.${signature}`), 401);
    });

    it('rejects a token signed with a different secret (401)', async () => {
      const forged = jwtService.sign(
        { sub: user.userId, email: user.email, role: UserRole.ADMIN },
        { secret: `${jwtSecret}-attacker` },
      );

      expectApiError(await me(forged), 401);
    });

    it('rejects an unsigned token with alg=none (401)', async () => {
      const unsigned = [
        b64url(JSON.stringify({ alg: 'none', typ: 'JWT' })),
        b64url(JSON.stringify({ sub: user.userId, email: user.email, role: UserRole.ADMIN })),
        '',
      ].join('.');

      expectApiError(await me(unsigned), 401);
    });

    it('rejects an expired access token (401) that was accepted while it was still valid', async () => {
      const shortLived = jwtService.sign(
        { sub: user.userId, email: user.email, role: UserRole.STUDENT },
        { expiresIn: 3 },
      );

      await me(shortLived).expect(200); // proves expiry, not the token's shape, is what fails later
      await sleep(3_300);

      expectApiError(await me(shortLived), 401);
    });

    it('rejects a correctly signed token whose user no longer exists (401)', async () => {
      const ghost = await createVerifiedUser('access-ghost');
      const { accessToken } = await loginAs(ghost.email);
      await me(accessToken).expect(200);

      await prisma.auditLog.deleteMany({ where: { actorId: ghost.userId } });
      await prisma.user.delete({ where: { id: ghost.userId } });

      expectApiError(await me(accessToken), 401, /không tồn tại/i);
    });
  });

  // =========================================================================
  // 6. REFRESH TOKEN — invalid / expired / reused
  // =========================================================================
  describe('Refresh token: invalid, expired, reused and revoked', () => {
    it('rejects a refresh without any cookie (401)', async () => {
      expectApiError(await refresh(), 401);
    });

    it.each([
      ['random garbage', 'garbage'],
      ['well-formed but unknown token', 'a'.repeat(80)],
    ])('rejects %s as refresh token (401) and does not set a new cookie', async (_label, value) => {
      const res = await refresh(`${cookieName}=${value}`);

      expectApiError(res, 401);
      expect(findCookie(res, cookieName)?.value ?? '').not.toBe(value);
      expect(res.body.accessToken).toBeUndefined();
    });

    it('rejects an expired refresh session (401)', async () => {
      const { email, userId } = await createVerifiedUser('refresh-expired');
      const { cookie } = await loginAs(email);

      await prisma.authSession.updateMany({
        where: { userId },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });

      expectApiError(await refresh(cookie), 401, /hết hạn/i);
    });

    it('detects reuse of a rotated refresh token and revokes the whole family', async () => {
      const { email, userId } = await createVerifiedUser('refresh-reuse');
      const { cookie: original } = await loginAs(email);

      const rotated = await refresh(original).expect(200);
      const rotatedCookie = findCookie(rotated, cookieName)!;
      expect(await activeSessionCount(userId)).toBe(1);

      // Attacker replays the already-consumed token
      expectApiError(await refresh(original), 401, /thu hồi/i);

      // ...and now even the legitimate, newest token is dead
      expectApiError(await refresh(rotatedCookie), 401);
      expect(await activeSessionCount(userId)).toBe(0);
    });

    it('does not let one device\'s reuse alarm kill an unrelated login of the same user', async () => {
      const { email, userId } = await createVerifiedUser('refresh-families');
      const deviceA = await loginAs(email);
      const deviceB = await loginAs(email);

      await refresh(deviceA.cookie).expect(200);
      await refresh(deviceA.cookie).expect(401); // reuse on device A -> family A revoked

      await refresh(deviceB.cookie).expect(200); // device B is a different family: still fine
      expect(await activeSessionCount(userId)).toBe(1);
    });

    it('rejects refresh with the cookie of a session that was logged out (401)', async () => {
      const { email } = await createVerifiedUser('refresh-after-logout');
      const { cookie } = await loginAs(email);

      await logout(cookie).expect(200);

      expectApiError(await refresh(cookie), 401);
    });
  });

  // =========================================================================
  // 7. LOGOUT
  // =========================================================================
  describe('Logout and logout-all', () => {
    it('is idempotent and never errors for missing or unknown refresh cookies (200)', async () => {
      const { email } = await createVerifiedUser('logout-idempotent');
      const { cookie } = await loginAs(email);

      await logout(cookie).expect(200);
      await logout(cookie).expect(200); // second time with the same cookie
      await logout().expect(200); // no cookie at all
      await logout(`${cookieName}=${'b'.repeat(80)}`).expect(200); // unknown cookie
    });

    it('only ends the current session; other devices stay logged in', async () => {
      const { email, userId } = await createVerifiedUser('logout-single');
      const phone = await loginAs(email);
      const laptop = await loginAs(email);

      await logout(phone.cookie).expect(200);

      expect(await activeSessionCount(userId)).toBe(1);
      await refresh(laptop.cookie).expect(200);
    });

    it('logout-all revokes every session of the user: no device can refresh afterwards', async () => {
      const { email, userId } = await createVerifiedUser('logout-all');
      const phone = await loginAs(email);
      const laptop = await loginAs(email);

      const res = await http()
        .post(`${API}/logout-all`)
        .set('Authorization', `Bearer ${phone.accessToken}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(await activeSessionCount(userId)).toBe(0);
      expectApiError(await refresh(phone.cookie), 401);
      expectApiError(await refresh(laptop.cookie), 401);
    });
  });
});
