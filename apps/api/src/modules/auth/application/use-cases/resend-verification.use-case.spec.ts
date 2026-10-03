import { BadRequestException, HttpException } from '@nestjs/common';
import { UserRole, UserStatus } from '@campusjob/contracts';
import { ResendVerificationUseCase } from './resend-verification.use-case';
import { IUserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { IEmailVerificationTokenRepository } from '../../domain/repositories/email-verification-token.repository.interface';
import { IMailService } from '../../../../shared/mail/mail.service.interface';
import { UserEntity } from '../../../users/domain/entities/user.entity';
import { EmailVerificationTokenEntity } from '../../domain/entities/email-verification-token.entity';

describe('ResendVerificationUseCase', () => {
  let useCase: ResendVerificationUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let tokenRepository: jest.Mocked<IEmailVerificationTokenRepository>;
  let mailService: jest.Mocked<IMailService>;

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      createWithVerificationToken: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    tokenRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      findLatestByUserId: jest.fn(),
      invalidatePendingTokensForUser: jest.fn(),
      consumeTokenAndVerifyUser: jest.fn(),
    };

    mailService = {
      sendMail: jest.fn(),
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };

    useCase = new ResendVerificationUseCase(
      userRepository,
      tokenRepository,
      mailService,
    );
  });

  it('should resend verification email for unverified user when cooldown has elapsed', async () => {
    const user = new UserEntity(
      'user-1',
      'student@example.com',
      'hash',
      'Nguyen Van A',
      UserRole.STUDENT,
      UserStatus.PENDING_VERIFICATION,
      null,
      null, // not verified
    );
    userRepository.findByEmail.mockResolvedValue(user);

    // Last token was created 2 minutes ago (> 60s cooldown)
    tokenRepository.findLatestByUserId.mockResolvedValue(
      new EmailVerificationTokenEntity(
        'old-token-id',
        'user-1',
        'old-hash',
        new Date(Date.now() + 3600000),
        null,
        new Date(Date.now() - 120000),
      ),
    );

    const result = await useCase.execute({ email: 'student@example.com' });

    expect(result.message).toContain('verification email has been sent');
    expect(tokenRepository.invalidatePendingTokensForUser).toHaveBeenCalledWith('user-1');
    expect(tokenRepository.create).toHaveBeenCalled();
    expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
      'student@example.com',
      expect.any(String),
    );
  });

  it('should reject resend when requested within cooldown (< 60s)', async () => {
    const user = new UserEntity(
      'user-1',
      'student@example.com',
      'hash',
      'Nguyen Van A',
      UserRole.STUDENT,
      UserStatus.PENDING_VERIFICATION,
      null,
      null,
    );
    userRepository.findByEmail.mockResolvedValue(user);

    // Last token created 20 seconds ago (< 60s cooldown)
    tokenRepository.findLatestByUserId.mockResolvedValue(
      new EmailVerificationTokenEntity(
        'recent-token-id',
        'user-1',
        'recent-hash',
        new Date(Date.now() + 3600000),
        null,
        new Date(Date.now() - 20000),
      ),
    );

    await expect(
      useCase.execute({ email: 'student@example.com' }),
    ).rejects.toThrow(HttpException);

    expect(tokenRepository.invalidatePendingTokensForUser).not.toHaveBeenCalled();
    expect(tokenRepository.create).not.toHaveBeenCalled();
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('should reject resend for an already verified account', async () => {
    const user = new UserEntity(
      'user-1',
      'student@example.com',
      'hash',
      'Nguyen Van A',
      UserRole.STUDENT,
      UserStatus.ACTIVE,
      null,
      new Date(), // verified
    );
    userRepository.findByEmail.mockResolvedValue(user);

    await expect(
      useCase.execute({ email: 'student@example.com' }),
    ).rejects.toThrow(BadRequestException);

    expect(tokenRepository.create).not.toHaveBeenCalled();
  });

  it('should return neutral response for non-existent email', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute({ email: 'nonexistent@example.com' });

    expect(result.message).toContain('If your account is registered');
    expect(tokenRepository.create).not.toHaveBeenCalled();
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
