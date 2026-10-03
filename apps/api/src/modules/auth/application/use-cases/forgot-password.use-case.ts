import {
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ForgotPasswordResponseDto } from '@campusjob/contracts';
import {
  USER_REPOSITORY_TOKEN,
  IUserRepository,
} from '../../../users/domain/repositories/user.repository.interface';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN,
  IPasswordResetTokenRepository,
} from '../../domain/repositories/password-reset-token.repository.interface';
import {
  MAIL_SERVICE_TOKEN,
  IMailService,
} from '../../../../shared/mail/mail.service.interface';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { TokenUtils } from '../../infrastructure/security/token.utils';

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const FORGOT_PASSWORD_COOLDOWN_MS = 60 * 1000; // 60 seconds

@Injectable()
export class ForgotPasswordUseCase {
  private readonly logger = new Logger(ForgotPasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN)
    private readonly tokenRepository: IPasswordResetTokenRepository,
    @Inject(MAIL_SERVICE_TOKEN)
    private readonly mailService: IMailService,
  ) {}

  async execute(dto: ForgotPasswordDto): Promise<ForgotPasswordResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    const neutralResponse: ForgotPasswordResponseDto = {
      message:
        'If this email address is registered, instructions to reset your password have been sent.',
    };

    if (!user) {
      // Neutral response to prevent email enumeration
      return neutralResponse;
    }

    // Cooldown check on latest token
    const latestToken = await this.tokenRepository.findLatestByUserId(user.id);
    if (latestToken && latestToken.createdAt) {
      const elapsed = Date.now() - latestToken.createdAt.getTime();
      if (elapsed < FORGOT_PASSWORD_COOLDOWN_MS) {
        const remainingSec = Math.ceil((FORGOT_PASSWORD_COOLDOWN_MS - elapsed) / 1000);
        throw new HttpException(
          `Please wait ${remainingSec} seconds before requesting another password reset`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Invalidate existing pending reset tokens for this user
    await this.tokenRepository.invalidatePendingTokensForUser(user.id);

    // Generate token
    const rawToken = TokenUtils.generateRandomToken(32);
    const tokenHash = TokenUtils.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.tokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Send email with raw token
    await this.mailService.sendPasswordResetEmail(user.email, rawToken);

    this.logger.log(`Password reset email dispatched for user ${user.id}`);

    return neutralResponse;
  }
}
