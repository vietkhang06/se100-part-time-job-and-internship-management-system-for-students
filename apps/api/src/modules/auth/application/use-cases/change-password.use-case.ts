import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ChangePasswordResponseDto, AuthErrorCode } from '@campusjob/contracts';
import {
  USER_REPOSITORY_TOKEN,
  IUserRepository,
} from '../../../users/domain/repositories/user.repository.interface';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';

@Injectable()
export class ChangePasswordUseCase {
  private readonly logger = new Logger(ChangePasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponseDto> {
    if (!userId) {
      throw new UnauthorizedException({
        message: 'Unauthorized',
        code: AuthErrorCode.UNAUTHORIZED,
      });
    }

    // 1. Find user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        message: 'User not found',
        code: AuthErrorCode.UNAUTHORIZED,
      });
    }

    // 2. Verify current password
    const isCurrentPasswordValid = await PasswordHasher.verify(
      user.passwordHash,
      dto.currentPassword,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException({
        message: 'Current password is incorrect.',
        code: AuthErrorCode.INVALID_CREDENTIALS,
      });
    }

    // 3. Ensure new password is not identical to current password
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException({
        message: 'New password must be different from the current password.',
        code: AuthErrorCode.VALIDATION_ERROR,
      });
    }

    // 4. Validate new password against complexity policy
    if (!PasswordHasher.validatePolicy(dto.newPassword)) {
      throw new BadRequestException({
        message:
          'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
        code: AuthErrorCode.WEAK_PASSWORD,
      });
    }

    // 5. Hash new password with Argon2id
    const newPasswordHash = await PasswordHasher.hash(dto.newPassword);

    // 6. Atomically update password and revoke all active sessions
    await this.userRepository.changePasswordAndRevokeSessions(
      userId,
      newPasswordHash,
    );

    this.logger.log(`Password changed successfully for user ${userId}`);

    return {
      message:
        'Password has been changed successfully. Please log in with your new password.',
    };
  }
}
