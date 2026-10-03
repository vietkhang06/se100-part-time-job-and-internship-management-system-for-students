import { PasswordResetTokenEntity } from '../entities/password-reset-token.entity';

export const PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN = Symbol(
  'PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN',
);

export interface IPasswordResetTokenRepository {
  create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetTokenEntity>;

  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenEntity | null>;

  findLatestByUserId(userId: string): Promise<PasswordResetTokenEntity | null>;

  invalidatePendingTokensForUser(userId: string): Promise<void>;

  resetPasswordAndRevokeSessions(
    tokenHash: string,
    userId: string,
    newPasswordHash: string,
  ): Promise<boolean>;
}
