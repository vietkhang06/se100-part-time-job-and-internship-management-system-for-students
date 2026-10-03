import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ResetPasswordResponseDto } from '@campusjob/contracts';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN,
  IPasswordResetTokenRepository,
} from '../../domain/repositories/password-reset-token.repository.interface';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';
import { TokenUtils } from '../../infrastructure/security/token.utils';

@Injectable()
export class ResetPasswordUseCase {
  private readonly logger = new Logger(ResetPasswordUseCase.name);

  constructor(
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN)
    private readonly tokenRepository: IPasswordResetTokenRepository,
  ) {}

  async execute(dto: ResetPasswordDto): Promise<ResetPasswordResponseDto> {
    if (!dto.token || dto.token.trim() === '') {
      throw new BadRequestException('Reset token is required');
    }

    const tokenHash = TokenUtils.hashToken(dto.token.trim());

    // 1. Find token
    const token = await this.tokenRepository.findByTokenHash(tokenHash);
    if (!token) {
      throw new BadRequestException('Password reset token is invalid or expired');
    }

    if (token.isUsed()) {
      throw new BadRequestException('Password reset token has already been used');
    }

    if (token.isExpired()) {
      throw new BadRequestException('Password reset token has expired');
    }

    // 2. Validate new password against complexity policy
    if (!PasswordHasher.validatePolicy(dto.newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
      );
    }

    // 3. Hash new password with Argon2id
    const newPasswordHash = await PasswordHasher.hash(dto.newPassword);

    // 4. Atomically reset password, mark token as used, and revoke all active sessions
    const success = await this.tokenRepository.resetPasswordAndRevokeSessions(
      tokenHash,
      token.userId,
      newPasswordHash,
    );

    if (!success) {
      throw new BadRequestException(
        'Password reset token is invalid, expired, or has already been used',
      );
    }

    this.logger.log(`Password reset successfully for user ${token.userId}`);

    return {
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  }
}
