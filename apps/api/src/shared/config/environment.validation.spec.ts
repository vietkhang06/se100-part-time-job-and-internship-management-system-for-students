import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { validateEnvironment } from './environment.validation';

const validEnvironment = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/campusjob?schema=public',
  JWT_ACCESS_SECRET: 'test-secret-value',
};

describe('validateEnvironment', () => {
  it('reports all missing required variables by name', () => {
    expect(() => validateEnvironment({})).toThrow('DATABASE_URL, JWT_ACCESS_SECRET');
  });

  it('rejects empty and whitespace-only required variables', () => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: '  ', JWT_ACCESS_SECRET: '\t' }),
    ).toThrow('DATABASE_URL, JWT_ACCESS_SECRET');
  });

  it('rejects malformed or non-PostgreSQL database URLs without exposing the value', () => {
    const privateUrl = 'not-a-database-url-with-private-value';
    let errorMessage = '';
    try {
      validateEnvironment({ ...validEnvironment, DATABASE_URL: privateUrl });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    expect(errorMessage).toContain('DATABASE_URL');
    expect(errorMessage).not.toContain(privateUrl);
  });

  it('rejects the previously documented JWT fallback placeholder', () => {
    const placeholder = 'replace_with_long_random_access_secret';
    let errorMessage = '';
    try {
      validateEnvironment({ ...validEnvironment, JWT_ACCESS_SECRET: placeholder });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    expect(errorMessage).toContain('JWT_ACCESS_SECRET');
    expect(errorMessage).not.toContain(placeholder);
  });

  it.each(['0', '-1', '1.5', 'abc', '', '999999999999999999999999'])('rejects invalid REFRESH_TOKEN_TTL_DAYS value %j', (value) => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, REFRESH_TOKEN_TTL_DAYS: value }),
    ).toThrow('REFRESH_TOKEN_TTL_DAYS');
  });

  it('rejects unsupported COOKIE_SECURE values', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, COOKIE_SECURE: 'yes' }),
    ).toThrow('COOKIE_SECURE');
  });

  it('requires secure refresh cookies in production', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, NODE_ENV: 'production' }),
    ).toThrow('COOKIE_SECURE');
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        COOKIE_SECURE: 'false',
      }),
    ).toThrow('COOKIE_SECURE');
    expect(
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        COOKIE_SECURE: 'true',
      }),
    ).toEqual({
      ...validEnvironment,
      NODE_ENV: 'production',
      COOKIE_SECURE: 'true',
    });
  });

  it('accepts valid config without imposing an undocumented JWT secret length', () => {
    expect(validateEnvironment(validEnvironment)).toEqual(validEnvironment);
  });

  it('lists multiple invalid names without including any configured values', () => {
    const secret = 'sensitive-test-secret';
    let errorMessage = '';
    try {
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: secret,
        REFRESH_TOKEN_TTL_DAYS: '0',
        COOKIE_SECURE: 'maybe',
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    expect(errorMessage).toContain('REFRESH_TOKEN_TTL_DAYS');
    expect(errorMessage).toContain('COOKIE_SECURE');
    expect(errorMessage).not.toContain(secret);
    expect(errorMessage).not.toContain(validEnvironment.DATABASE_URL);
  });
});

describe('application configuration startup', () => {
  const environmentKeys = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'REFRESH_TOKEN_TTL_DAYS',
    'COOKIE_SECURE',
    'NODE_ENV',
  ] as const;

  async function bootstrapConfigApplication(
    environment: Record<string, string | undefined>,
  ): Promise<INestApplication> {
    const previous = new Map<string, string | undefined>();
    for (const key of environmentKeys) {
      previous.set(key, process.env[key]);
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(environment)) {
      if (value !== undefined) process.env[key] = value;
    }

    let moduleFixture: TestingModule;
    try {
      moduleFixture = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            validate: validateEnvironment,
          }),
        ],
      }).compile();
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }

    const app = moduleFixture.createNestApplication();
    await app.init();
    return app;
  }

  it('prevents application startup with invalid security configuration', async () => {
    await expect(
      bootstrapConfigApplication({ DATABASE_URL: validEnvironment.DATABASE_URL }),
    ).rejects.toThrow('JWT_ACCESS_SECRET');
  });

  it('starts the application with valid security configuration', async () => {
    const app = await bootstrapConfigApplication(validEnvironment);
    try {
      expect(app.get(ConfigService).getOrThrow('JWT_ACCESS_SECRET')).toBe(
        validEnvironment.JWT_ACCESS_SECRET,
      );
    } finally {
      await app.close();
    }
  });
});
