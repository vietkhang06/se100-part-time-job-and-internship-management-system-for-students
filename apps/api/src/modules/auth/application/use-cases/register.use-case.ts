import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { UserRole, UserStatus, RegisterResponseDto } from '@campusjob/contracts';
import {
  USER_REPOSITORY_TOKEN,
  IUserRepository,
} from '../../../users/domain/repositories/user.repository.interface';
import {
  MAIL_SERVICE_TOKEN,
  IMailService,
} from '../../../../shared/mail/mail.service.interface';
import { RegisterDto } from '../dto/register.dto';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';
import { TokenUtils } from '../../infrastructure/security/token.utils';

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class RegisterUseCase {
  private readonly logger = new Logger(RegisterUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(MAIL_SERVICE_TOKEN)
    private readonly mailService: IMailService,
  ) {}

  async execute(dto: RegisterDto): Promise<RegisterResponseDto> {
    // 1. Role Authorization enforcement
    if (dto.role !== UserRole.STUDENT && dto.role !== UserRole.EMPLOYER) {
      throw new BadRequestException(
        'Only STUDENT and EMPLOYER roles are permitted for self-registration',
      );
    }

    // 2. Email normalization
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 3. Check existing user
    const existing = await this.userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    // 4. Validate password policy
    if (!PasswordHasher.validatePolicy(dto.password)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
      );
    }

    // 5. Hash password
    const passwordHash = await PasswordHasher.hash(dto.password);

    // 6. Generate verification token
    const rawToken = TokenUtils.generateRandomToken(32);
    const tokenHash = TokenUtils.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    // 7. Persist user and token atomically
    let createdUserResult;
    try {
      createdUserResult = await this.userRepository.createWithVerificationToken(
        {
          email: normalizedEmail,
          passwordHash,
          fullName: dto.fullName.trim(),
          phone: dto.phone?.trim() ?? null,
          role: dto.role,
          status: UserStatus.PENDING_VERIFICATION,
          emailVerifiedAt: null,
        },
        tokenHash,
        expiresAt,
      );
    } catch (err: any) {
      if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
        throw new ConflictException('Email is already registered');
      }
      throw err;
    }

    const { user } = createdUserResult;

    // 8. Dispatch verification email (raw token sent, hash stored)
    await this.mailService.sendVerificationEmail(normalizedEmail, rawToken);

    this.logger.log(`User registered successfully: ${user.id} (${normalizedEmail})`);

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        emailVerified: false,
      },
    };
  }
}
