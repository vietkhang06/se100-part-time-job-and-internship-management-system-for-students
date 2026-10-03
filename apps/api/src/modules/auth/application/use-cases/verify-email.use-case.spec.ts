import { BadRequestException } from '@nestjs/common';
import { UserRole, UserStatus } from '@campusjob/contracts';
import { VerifyEmailUseCase } from './verify-email.use-case';
import { IEmailVerificationTokenRepository } from '../../domain/repositories/email-verification-token.repository.interface';
import { IUserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { EmailVerificationTokenEntity } from '../../domain/entities/email-verification-token.entity';
import { UserEntity } from '../../../users/domain/entities/user.entity';
import { TokenUtils } from '../../infrastructure/security/token.utils';

describe('VerifyEmailUseCase', () => {
  let useCase: VerifyEmailUseCase;
  let tokenRepository: jest.Mocked<IEmailVerificationTokenRepository>;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    tokenRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      findLatestByUserId: jest.fn(),
      invalidatePendingTokensForUser: jest.fn(),
      consumeTokenAndVerifyUser: jest.fn(),
    };

    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      createWithVerificationToken: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    useCase = new VerifyEmailUseCase(tokenRepository, userRepository);
  });

  it('should successfully verify email with valid token', async () => {
    const rawToken = 'valid-verification-token-string';
    const tokenHash = TokenUtils.hashToken(rawToken);

    tokenRepository.findByTokenHash.mockResolvedValue(
      new EmailVerificationTokenEntity(
        'token-1',
        'user-1',
        tokenHash,
        new Date(Date.now() + 3600000), // 1h in future
        null,
      ),
    );

    tokenRepository.consumeTokenAndVerifyUser.mockResolvedValue(true);

    userRepository.findById.mockResolvedValue(
      new UserEntity(
        'user-1',
        'student@example.com',
        'hash',
        'Nguyen Van A',
        UserRole.STUDENT,
        UserStatus.ACTIVE,
        null,
        new Date(),
      ),
    );

    const result = await useCase.execute({ token: rawToken });

    expect(result.message).toContain('Email verified successfully');
    expect(result.email).toBe('student@example.com');
    expect(tokenRepository.consumeTokenAndVerifyUser).toHaveBeenCalledWith(
      tokenHash,
      'user-1',
    );
  });

  it('should reject non-existing token', async () => {
    tokenRepository.findByTokenHash.mockResolvedValue(null);

    await expect(
      useCase.execute({ token: 'unknown-token' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject expired token', async () => {
    const rawToken = 'expired-token';
    const tokenHash = TokenUtils.hashToken(rawToken);

    tokenRepository.findByTokenHash.mockResolvedValue(
      new EmailVerificationTokenEntity(
        'token-1',
        'user-1',
        tokenHash,
        new Date(Date.now() - 3600000), // 1h in past
        null,
      ),
    );

    await expect(useCase.execute({ token: rawToken })).rejects.toThrow(
      BadRequestException,
    );
    expect(tokenRepository.consumeTokenAndVerifyUser).not.toHaveBeenCalled();
  });

  it('should reject already used token', async () => {
    const rawToken = 'used-token';
    const tokenHash = TokenUtils.hashToken(rawToken);

    tokenRepository.findByTokenHash.mockResolvedValue(
      new EmailVerificationTokenEntity(
        'token-1',
        'user-1',
        tokenHash,
        new Date(Date.now() + 3600000),
        new Date(), // already used
      ),
    );

    await expect(useCase.execute({ token: rawToken })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject when concurrent request consumes the token first', async () => {
    const rawToken = 'concurrent-token';
    const tokenHash = TokenUtils.hashToken(rawToken);

    tokenRepository.findByTokenHash.mockResolvedValue(
      new EmailVerificationTokenEntity(
        'token-1',
        'user-1',
        tokenHash,
        new Date(Date.now() + 3600000),
        null,
      ),
    );

    // Concurrent request consumed it in DB before this transaction committed
    tokenRepository.consumeTokenAndVerifyUser.mockResolvedValue(false);

    await expect(useCase.execute({ token: rawToken })).rejects.toThrow(
      BadRequestException,
    );
  });
});
