import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { VerifyEmailResponseDto } from '@campusjob/contracts';
import {
  EMAIL_VERIFICATION_TOKEN_REPOSITORY_TOKEN,
  IEmailVerificationTokenRepository,
} from '../../domain/repositories/email-verification-token.repository.interface';
import {
  USER_REPOSITORY_TOKEN,
  IUserRepository,
} from '../../../users/domain/repositories/user.repository.interface';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { TokenUtils } from '../../infrastructure/security/token.utils';

@Injectable()
export class VerifyEmailUseCase {
  private readonly logger = new Logger(VerifyEmailUseCase.name);

  constructor(
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY_TOKEN)
    private readonly tokenRepository: IEmailVerificationTokenRepository,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    if (!dto.token || dto.token.trim() === '') {
      throw new BadRequestException('Verification token is required');
    }

    const tokenHash = TokenUtils.hashToken(dto.token.trim());

    // 1. Find token
    const token = await this.tokenRepository.findByTokenHash(tokenHash);
    if (!token) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // 2. Validate token state
    if (token.isUsed()) {
      throw new BadRequestException('Verification token has already been used');
    }

    if (token.isExpired()) {
      throw new BadRequestException('Verification token has expired');
    }

    // 3. Concurrency-safe atomic token consumption
    const success = await this.tokenRepository.consumeTokenAndVerifyUser(
      tokenHash,
      token.userId,
    );

    if (!success) {
      throw new BadRequestException(
        'Verification token has already been used or is no longer valid',
      );
    }

    const user = await this.userRepository.findById(token.userId);
    if (!user) {
      throw new NotFoundException('Associated user account was not found');
    }

    this.logger.log(`Email successfully verified for user ${user.id} (${user.email})`);

    return {
      message: 'Email verified successfully. Your account is now active.',
      email: user.email,
    };
  }
}
