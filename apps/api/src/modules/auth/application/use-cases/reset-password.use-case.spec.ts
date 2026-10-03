import { BadRequestException } from '@nestjs/common';
import { ResetPasswordUseCase } from './reset-password.use-case';
import { IPasswordResetTokenRepository } from '../../domain/repositories/password-reset-token.repository.interface';
import { PasswordResetTokenEntity } from '../../domain/entities/password-reset-token.entity';
import { TokenUtils } from '../../infrastructure/security/token.utils';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';

describe('ResetPasswordUseCase', () => {
  let useCase: ResetPasswordUseCase;
  let tokenRepository: jest.Mocked<IPasswordResetTokenRepository>;

  beforeEach(() => {
    tokenRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      findLatestByUserId: jest.fn(),
      invalidatePendingTokensForUser: jest.fn(),
      resetPasswordAndRevokeSessions: jest.fn(),
    };

    useCase = new ResetPasswordUseCase(tokenRepository);
  });

  it('should successfully reset password with valid token and strong new password', async () => {
    const rawToken = 'valid-reset-token-xyz';
    const tokenHash = TokenUtils.hashToken(rawToken);

    tokenRepository.findByTokenHash.mockResolvedValue(
      new PasswordResetTokenEntity(
        'token-1',
        'user-1',
        tokenHash,
        new Date(Date.now() + 3600000), // 1h in future
        null,
      ),
    );

    let capturedNewHash = '';
    tokenRepository.resetPasswordAndRevokeSessions.mockImplementation(
      async (_hash, _uid, newPassHash) => {
        capturedNewHash = newPassHash;
        return true;
      },
    );

    const result = await useCase.execute({
      token: rawToken,
      newPassword: 'BrandNewSecurePassword456!',
    });

    expect(result.message).toContain('Password has been reset successfully');
    expect(tokenRepository.resetPasswordAndRevokeSessions).toHaveBeenCalledWith(
      tokenHash,
      'user-1',
      expect.any(String),
    );

    const isMatch = await PasswordHasher.verify(
      capturedNewHash,
      'BrandNewSecurePassword456!',
    );
    expect(isMatch).toBe(true);
  });

  it('should reject non-existing reset token', async () => {
    tokenRepository.findByTokenHash.mockResolvedValue(null);

    await expect(
      useCase.execute({
        token: 'unknown-token',
        newPassword: 'BrandNewSecurePassword456!',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(tokenRepository.resetPasswordAndRevokeSessions).not.toHaveBeenCalled();
  });

  it('should reject expired reset token', async () => {
    const rawToken = 'expired-token';
    const tokenHash = TokenUtils.hashToken(rawToken);

    tokenRepository.findByTokenHash.mockResolvedValue(
      new PasswordResetTokenEntity(
        'token-1',
        'user-1',
        tokenHash,
        new Date(Date.now() - 3600000), // 1h in past
        null,
      ),
    );

    await expect(
      useCase.execute({
        token: rawToken,
        newPassword: 'BrandNewSecurePassword456!',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject already used reset token', async () => {
    const rawToken = 'used-token';
    const tokenHash = TokenUtils.hashToken(rawToken);

    tokenRepository.findByTokenHash.mockResolvedValue(
      new PasswordResetTokenEntity(
        'token-1',
        'user-1',
        tokenHash,
        new Date(Date.now() + 3600000),
        new Date(), // already used
      ),
    );

    await expect(
      useCase.execute({
        token: rawToken,
        newPassword: 'BrandNewSecurePassword456!',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject weak new password', async () => {
    const rawToken = 'valid-token';
    const tokenHash = TokenUtils.hashToken(rawToken);

    tokenRepository.findByTokenHash.mockResolvedValue(
      new PasswordResetTokenEntity(
        'token-1',
        'user-1',
        tokenHash,
        new Date(Date.now() + 3600000),
        null,
      ),
    );

    await expect(
      useCase.execute({
        token: rawToken,
        newPassword: 'weak',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(tokenRepository.resetPasswordAndRevokeSessions).not.toHaveBeenCalled();
  });

  it('should reject if concurrent request reset the token first', async () => {
    const rawToken = 'valid-token';
    const tokenHash = TokenUtils.hashToken(rawToken);

    tokenRepository.findByTokenHash.mockResolvedValue(
      new PasswordResetTokenEntity(
        'token-1',
        'user-1',
        tokenHash,
        new Date(Date.now() + 3600000),
        null,
      ),
    );

    tokenRepository.resetPasswordAndRevokeSessions.mockResolvedValue(false);

    await expect(
      useCase.execute({
        token: rawToken,
        newPassword: 'BrandNewSecurePassword456!',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
