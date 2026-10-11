import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus, AuthErrorCode } from '@campusjob/contracts';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { IUserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { UserEntity } from '../../../users/domain/entities/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userRepository: jest.Mocked<IUserRepository>;
  let configService: any;

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      createWithVerificationToken: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultVal: any) => {
        if (key === 'JWT_ACCESS_SECRET') return 'test_jwt_secret_key_12345';
        return defaultVal;
      }),
    };

    strategy = new JwtStrategy(configService, userRepository);
  });

  const payload: JwtPayload = {
    sub: 'user-1',
    email: 'user@campusjob.local',
    role: UserRole.STUDENT,
    sessionId: 'session-123',
  };

  it('should validate and return user payload when account is ACTIVE', async () => {
    const activeUser = new UserEntity(
      'user-1',
      'user@campusjob.local',
      'hash',
      'Nguyen Van A',
      UserRole.STUDENT,
      UserStatus.ACTIVE,
      '0912345678',
      new Date(),
    );
    userRepository.findById.mockResolvedValue(activeUser);

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      id: 'user-1',
      email: 'user@campusjob.local',
      fullName: 'Nguyen Van A',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      phone: '0912345678',
      emailVerified: true,
      sessionId: 'session-123',
    });
  });

  it('should throw UnauthorizedException when user does not exist in database', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw ForbiddenException with ACCOUNT_SUSPENDED when account is SUSPENDED', async () => {
    const suspendedUser = new UserEntity(
      'user-1',
      'user@campusjob.local',
      'hash',
      'Nguyen Van A',
      UserRole.STUDENT,
      UserStatus.SUSPENDED,
      null,
      new Date(),
    );
    userRepository.findById.mockResolvedValue(suspendedUser);

    try {
      await strategy.validate(payload);
      fail('Expected ForbiddenException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const res = err.getResponse();
      expect(res.code).toBe(AuthErrorCode.ACCOUNT_SUSPENDED);
    }
  });

  it('should throw ForbiddenException with ACCOUNT_LOCKED when account is LOCKED', async () => {
    const lockedUser = new UserEntity(
      'user-1',
      'user@campusjob.local',
      'hash',
      'Nguyen Van A',
      UserRole.STUDENT,
      UserStatus.LOCKED,
      null,
      new Date(),
    );
    userRepository.findById.mockResolvedValue(lockedUser);

    try {
      await strategy.validate(payload);
      fail('Expected ForbiddenException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const res = err.getResponse();
      expect(res.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
    }
  });

  it('should throw ForbiddenException with ACCOUNT_PENDING_VERIFICATION when account is PENDING_VERIFICATION', async () => {
    const pendingUser = new UserEntity(
      'user-1',
      'user@campusjob.local',
      'hash',
      'Nguyen Van A',
      UserRole.STUDENT,
      UserStatus.PENDING_VERIFICATION,
      null,
      null,
    );
    userRepository.findById.mockResolvedValue(pendingUser);

    try {
      await strategy.validate(payload);
      fail('Expected ForbiddenException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const res = err.getResponse();
      expect(res.code).toBe(AuthErrorCode.ACCOUNT_PENDING_VERIFICATION);
    }
  });
});
