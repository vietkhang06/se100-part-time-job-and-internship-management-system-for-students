import {
  Injectable,
  Inject,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ResendVerificationResponseDto } from '@campusjob/contracts';
import {
  USER_REPOSITORY_TOKEN,
  IUserRepository,
} from '../../../users/domain/repositories/user.repository.interface';
import {
  EMAIL_VERIFICATION_TOKEN_REPOSITORY_TOKEN,
  IEmailVerificationTokenRepository,
} from '../../domain/repositories/email-verification-token.repository.interface';
import {
  MAIL_SERVICE_TOKEN,
  IMailService,
} from '../../../../shared/mail/mail.service.interface';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { TokenUtils } from '../../infrastructure/security/token.utils';
import { VERIFICATION_TOKEN_TTL_MS } from './register.use-case';

export const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

@Injectable()
export class ResendVerificationUseCase {
  private readonly logger = new Logger(ResendVerificationUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY_TOKEN)
    private readonly tokenRepository: IEmailVerificationTokenRepository,
    @Inject(MAIL_SERVICE_TOKEN)
    private readonly mailService: IMailService,
  ) {}

  async execute(dto: ResendVerificationDto): Promise<ResendVerificationResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    // To prevent user enumeration while adhering to business rules:
    if (!user) {
      return {
        message: 'If your account is registered, a new verification email has been sent.',
      };
    }

    if (user.isVerified()) {
      throw new BadRequestException('This account has already been verified.');
    }

    // Check cooldown from latest token
    const latestToken = await this.tokenRepository.findLatestByUserId(user.id);
    if (latestToken && latestToken.createdAt) {
      const elapsed = Date.now() - latestToken.createdAt.getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const remainingSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new HttpException(
          `Please wait ${remainingSec} seconds before requesting another verification email`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Invalidate prior pending tokens
    await this.tokenRepository.invalidatePendingTokensForUser(user.id);

    // Generate new token
    const rawToken = TokenUtils.generateRandomToken(32);
    const tokenHash = TokenUtils.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    await this.tokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Dispatch email
    await this.mailService.sendVerificationEmail(user.email, rawToken);

    this.logger.log(`Resent verification email for user ${user.id}`);

    return {
      message: 'A new verification email has been sent. Please check your inbox.',
    };
  }
}
