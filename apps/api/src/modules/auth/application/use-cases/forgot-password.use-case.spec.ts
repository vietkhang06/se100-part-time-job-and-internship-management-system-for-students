import { HttpException } from '@nestjs/common';
import { UserRole, UserStatus } from '@campusjob/contracts';
import { ForgotPasswordUseCase } from './forgot-password.use-case';
import { IUserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { IPasswordResetTokenRepository } from '../../domain/repositories/password-reset-token.repository.interface';
import { IMailService } from '../../../../shared/mail/mail.service.interface';
import { UserEntity } from '../../../users/domain/entities/user.entity';
import { PasswordResetTokenEntity } from '../../domain/entities/password-reset-token.entity';

describe('ForgotPasswordUseCase', () => {
  let useCase: ForgotPasswordUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let tokenRepository: jest.Mocked<IPasswordResetTokenRepository>;
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
      resetPasswordAndRevokeSessions: jest.fn(),
    };

    mailService = {
      sendMail: jest.fn(),
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };

    useCase = new ForgotPasswordUseCase(
      userRepository,
      tokenRepository,
      mailService,
    );
  });

  it('should return neutral response and dispatch email when user exists', async () => {
    const user = new UserEntity(
      'user-1',
      'student@example.com',
      'hash',
      'Nguyen Van A',
      UserRole.STUDENT,
      UserStatus.ACTIVE,
    );
    userRepository.findByEmail.mockResolvedValue(user);
    tokenRepository.findLatestByUserId.mockResolvedValue(null);

    const result = await useCase.execute({ email: 'student@example.com' });

    expect(result.message).toContain('If this email address is registered');
    expect(tokenRepository.invalidatePendingTokensForUser).toHaveBeenCalledWith('user-1');
    expect(tokenRepository.create).toHaveBeenCalled();
    expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      'student@example.com',
      expect.any(String),
    );
  });

  it('should return identical neutral response when user does NOT exist without leaking presence', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute({ email: 'unknown@example.com' });

    expect(result.message).toContain('If this email address is registered');
    expect(tokenRepository.create).not.toHaveBeenCalled();
    expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should reject when requested within cooldown (< 60s)', async () => {
    const user = new UserEntity(
      'user-1',
      'student@example.com',
      'hash',
      'Nguyen Van A',
      UserRole.STUDENT,
      UserStatus.ACTIVE,
    );
    userRepository.findByEmail.mockResolvedValue(user);

    tokenRepository.findLatestByUserId.mockResolvedValue(
      new PasswordResetTokenEntity(
        'recent-token',
        'user-1',
        'hash',
        new Date(Date.now() + 3600000),
        null,
        new Date(Date.now() - 15000), // 15 seconds ago
      ),
    );

    await expect(
      useCase.execute({ email: 'student@example.com' }),
    ).rejects.toThrow(HttpException);

    expect(tokenRepository.create).not.toHaveBeenCalled();
    expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
