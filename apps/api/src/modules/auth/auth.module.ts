import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../../shared/mail/mail.module';
import { AuthController } from './presentation/controllers/auth.controller';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { ResendVerificationUseCase } from './application/use-cases/resend-verification.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { EMAIL_VERIFICATION_TOKEN_REPOSITORY_TOKEN } from './domain/repositories/email-verification-token.repository.interface';
import { PrismaEmailVerificationTokenRepository } from './infrastructure/persistence/prisma-email-verification-token.repository';
import { PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN } from './domain/repositories/password-reset-token.repository.interface';
import { PrismaPasswordResetTokenRepository } from './infrastructure/persistence/prisma-password-reset-token.repository';

@Module({
  imports: [DatabaseModule, UsersModule, MailModule],
  controllers: [AuthController],
  providers: [
    {
      provide: EMAIL_VERIFICATION_TOKEN_REPOSITORY_TOKEN,
      useClass: PrismaEmailVerificationTokenRepository,
    },
    {
      provide: PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN,
      useClass: PrismaPasswordResetTokenRepository,
    },
    RegisterUseCase,
    VerifyEmailUseCase,
    ResendVerificationUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
  ],
  exports: [
    EMAIL_VERIFICATION_TOKEN_REPOSITORY_TOKEN,
    PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN,
    RegisterUseCase,
    VerifyEmailUseCase,
    ResendVerificationUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
  ],
})
export class AuthModule {}
