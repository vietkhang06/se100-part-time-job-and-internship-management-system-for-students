import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../shared/database/database.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../../shared/mail/mail.module';
import { AuthController } from './presentation/controllers/auth.controller';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { ResendVerificationUseCase } from './application/use-cases/resend-verification.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RefreshUseCase } from './application/use-cases/refresh.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { LogoutAllUseCase } from './application/use-cases/logout-all.use-case';
import { EMAIL_VERIFICATION_TOKEN_REPOSITORY_TOKEN } from './domain/repositories/email-verification-token.repository.interface';
import { PrismaEmailVerificationTokenRepository } from './infrastructure/persistence/prisma-email-verification-token.repository';
import { PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN } from './domain/repositories/password-reset-token.repository.interface';
import { PrismaPasswordResetTokenRepository } from './infrastructure/persistence/prisma-password-reset-token.repository';
import { AUTH_SESSION_REPOSITORY_TOKEN } from './domain/repositories/auth-session.repository.interface';
import { PrismaAuthSessionRepository } from './infrastructure/persistence/prisma-auth-session.repository';
import { JwtStrategy } from './infrastructure/security/jwt.strategy';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';

type JwtExpiration = NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];

export function parseJwtExpiration(value: string | undefined): JwtExpiration {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error('JWT_ACCESS_EXPIRES_IN must be a non-empty duration string.');
  }

  try {
    new JwtService().sign(
      { iat: 100 },
      { secret: 'jwt-duration-validation-only', expiresIn: normalized as JwtExpiration },
    );
  } catch {
    throw new Error('JWT_ACCESS_EXPIRES_IN must be a valid duration string.');
  }

  return normalized as JwtExpiration;
}

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    MailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_ACCESS_SECRET',
          'replace_with_long_random_access_secret',
        ),
        signOptions: {
          expiresIn: parseJwtExpiration(
            configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
          ),
        },
      }),
      inject: [ConfigService],
    }),
  ],
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
    {
      provide: AUTH_SESSION_REPOSITORY_TOKEN,
      useClass: PrismaAuthSessionRepository,
    },
    RegisterUseCase,
    VerifyEmailUseCase,
    ResendVerificationUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    ChangePasswordUseCase,
    LoginUseCase,
    RefreshUseCase,
    LogoutUseCase,
    LogoutAllUseCase,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    EMAIL_VERIFICATION_TOKEN_REPOSITORY_TOKEN,
    PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN,
    AUTH_SESSION_REPOSITORY_TOKEN,
    RegisterUseCase,
    VerifyEmailUseCase,
    ResendVerificationUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    ChangePasswordUseCase,
    LoginUseCase,
    RefreshUseCase,
    LogoutUseCase,
    LogoutAllUseCase,
    JwtModule,
    PassportModule,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
