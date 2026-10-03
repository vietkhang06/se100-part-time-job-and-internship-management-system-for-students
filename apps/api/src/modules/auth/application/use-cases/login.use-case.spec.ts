import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus } from '@campusjob/contracts';
import { LoginUseCase } from './login.use-case';
import { IUserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { IAuthSessionRepository } from '../../domain/repositories/auth-session.repository.interface';
import { UserEntity } from '../../../users/domain/entities/user.entity';
import { AuthSessionEntity } from '../../domain/entities/auth-session.entity';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let authSessionRepository: jest.Mocked<IAuthSessionRepository>;
  let jwtService: any;
  let configService: any;

  const validPassword = 'SecurePassword123!';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await PasswordHasher.hash(validPassword);
  });

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      createWithVerificationToken: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    authSessionRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      findById: jest.fn(),
      revokeById: jest.fn(),
      revokeFamily: jest.fn(),
      revokeAllForUser: jest.fn(),
      rotateSession: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock.jwt.access_token'),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultVal: any) => {
        if (key === 'REFRESH_TOKEN_TTL_DAYS') return 30;
        return defaultVal;
      }),
    };

    useCase = new LoginUseCase(
      userRepository,
      authSessionRepository,
      jwtService,
      configService,
    );
  });

  it('should successfully log in with valid credentials', async () => {
    const user = new UserEntity(
      'user-1',
      'student@example.com',
      passwordHash,
      'Nguyen Van A',
      UserRole.STUDENT,
      UserStatus.ACTIVE,
      '0901234567',
      new Date(),
    );

    userRepository.findByEmail.mockResolvedValue(user);
    authSessionRepository.create.mockResolvedValue(
      new AuthSessionEntity(
        'session-1',
        'user-1',
        'hashed_token',
        'family-1',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ),
    );

    const result = await useCase.execute(
      { email: ' STUDENT@EXAMPLE.COM ', password: validPassword },
      'Chrome/120',
      '127.0.0.1',
    );

    expect(result).toHaveProperty('accessToken', 'mock.jwt.access_token');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.id).toBe('user-1');
    expect(result.user.email).toBe('student@example.com');
    expect(result.user.emailVerified).toBe(true);

    expect(userRepository.findByEmail).toHaveBeenCalledWith('student@example.com');
    expect(authSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        userAgent: 'Chrome/120',
        ipAddress: '127.0.0.1',
      }),
    );
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-1',
        email: 'student@example.com',
        role: UserRole.STUDENT,
        sessionId: 'session-1',
      }),
    );
  });

  it('should throw UnauthorizedException when email does not exist', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'unknown@example.com', password: validPassword }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when password is incorrect', async () => {
    const user = new UserEntity(
      'user-1',
      'student@example.com',
      passwordHash,
      'Nguyen Van A',
      UserRole.STUDENT,
      UserStatus.ACTIVE,
    );
    userRepository.findByEmail.mockResolvedValue(user);

    await expect(
      useCase.execute({ email: 'student@example.com', password: 'WrongPassword123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException when user is suspended', async () => {
    const user = new UserEntity(
      'user-1',
      'suspended@example.com',
      passwordHash,
      'Nguyen Van Suspended',
      UserRole.STUDENT,
      UserStatus.SUSPENDED,
    );
    userRepository.findByEmail.mockResolvedValue(user);

    await expect(
      useCase.execute({ email: 'suspended@example.com', password: validPassword }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is locked', async () => {
    const user = new UserEntity(
      'user-1',
      'locked@example.com',
      passwordHash,
      'Nguyen Van Locked',
      UserRole.STUDENT,
      UserStatus.LOCKED,
    );
    userRepository.findByEmail.mockResolvedValue(user);

    await expect(
      useCase.execute({ email: 'locked@example.com', password: validPassword }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when email is pending verification', async () => {
    const user = new UserEntity(
      'user-1',
      'pending@example.com',
      passwordHash,
      'Nguyen Van Pending',
      UserRole.STUDENT,
      UserStatus.PENDING_VERIFICATION,
    );
    userRepository.findByEmail.mockResolvedValue(user);

    await expect(
      useCase.execute({ email: 'pending@example.com', password: validPassword }),
    ).rejects.toThrow(ForbiddenException);
  });
});
