import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus } from '@campusjob/contracts';
import { RefreshUseCase } from './refresh.use-case';
import { IAuthSessionRepository } from '../../domain/repositories/auth-session.repository.interface';
import { IUserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { AuthSessionEntity } from '../../domain/entities/auth-session.entity';
import { UserEntity } from '../../../users/domain/entities/user.entity';

describe('RefreshUseCase', () => {
  let useCase: RefreshUseCase;
  let authSessionRepository: jest.Mocked<IAuthSessionRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let jwtService: any;
  let configService: any;

  beforeEach(() => {
    authSessionRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      findById: jest.fn(),
      revokeById: jest.fn(),
      revokeFamily: jest.fn(),
      revokeAllForUser: jest.fn(),
      rotateSession: jest.fn(),
    };

    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      createWithVerificationToken: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    jwtService = {
      sign: jest.fn().mockReturnValue('mock.rotated.jwt.token'),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultVal: any) => {
        if (key === 'REFRESH_TOKEN_TTL_DAYS') return 30;
        return defaultVal;
      }),
    };

    useCase = new RefreshUseCase(
      authSessionRepository,
      userRepository,
      jwtService,
      configService,
    );
  });

  it('should successfully rotate tokens for a valid session', async () => {
    const existingSession = new AuthSessionEntity(
      'session-1',
      'user-1',
      'hash-1',
      'family-1',
      new Date(Date.now() + 1000000),
      null,
    );

    const rotatedSession = new AuthSessionEntity(
      'session-2',
      'user-1',
      'hash-2',
      'family-1',
      new Date(Date.now() + 1000000),
      null,
    );

    const user = new UserEntity(
      'user-1',
      'student@example.com',
      'hash',
      'Student Name',
      UserRole.STUDENT,
      UserStatus.ACTIVE,
      null,
      new Date(),
    );

    authSessionRepository.findByTokenHash.mockResolvedValue(existingSession);
    authSessionRepository.rotateSession.mockResolvedValue(rotatedSession);
    userRepository.findById.mockResolvedValue(user);

    const result = await useCase.execute('valid_raw_token_123', 'Firefox', '10.0.0.1');

    expect(result).toHaveProperty('accessToken', 'mock.rotated.jwt.token');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.id).toBe('user-1');

    expect(authSessionRepository.rotateSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        userId: 'user-1',
        tokenFamily: 'family-1',
      }),
    );
  });

  it('should detect reuse and revoke entire family if session was already revoked', async () => {
    const revokedSession = new AuthSessionEntity(
      'session-old',
      'user-1',
      'hash-old',
      'family-stolen',
      new Date(Date.now() + 1000000),
      new Date(), // Already revoked!
    );

    authSessionRepository.findByTokenHash.mockResolvedValue(revokedSession);

    await expect(useCase.execute('stolen_token_xyz')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(authSessionRepository.revokeFamily).toHaveBeenCalledWith('family-stolen');
  });

  it('should throw UnauthorizedException if session is expired', async () => {
    const expiredSession = new AuthSessionEntity(
      'session-expired',
      'user-1',
      'hash-expired',
      'family-1',
      new Date(Date.now() - 10000), // Expired
      null,
    );

    authSessionRepository.findByTokenHash.mockResolvedValue(expiredSession);

    await expect(useCase.execute('expired_token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException if token is missing or not found', async () => {
    await expect(useCase.execute(undefined)).rejects.toThrow(UnauthorizedException);

    authSessionRepository.findByTokenHash.mockResolvedValue(null);
    await expect(useCase.execute('nonexistent_token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw ForbiddenException if user is suspended during refresh', async () => {
    const existingSession = new AuthSessionEntity(
      'session-1',
      'user-1',
      'hash-1',
      'family-1',
      new Date(Date.now() + 1000000),
      null,
    );

    const rotatedSession = new AuthSessionEntity(
      'session-2',
      'user-1',
      'hash-2',
      'family-1',
      new Date(Date.now() + 1000000),
      null,
    );

    const suspendedUser = new UserEntity(
      'user-1',
      'student@example.com',
      'hash',
      'Student Name',
      UserRole.STUDENT,
      UserStatus.SUSPENDED,
    );

    authSessionRepository.findByTokenHash.mockResolvedValue(existingSession);
    authSessionRepository.rotateSession.mockResolvedValue(rotatedSession);
    userRepository.findById.mockResolvedValue(suspendedUser);

    await expect(useCase.execute('valid_raw_token')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
