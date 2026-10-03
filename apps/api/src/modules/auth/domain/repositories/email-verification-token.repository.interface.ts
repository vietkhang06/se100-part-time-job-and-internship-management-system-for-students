import { EmailVerificationTokenEntity } from '../entities/email-verification-token.entity';

export const EMAIL_VERIFICATION_TOKEN_REPOSITORY_TOKEN = Symbol(
  'EMAIL_VERIFICATION_TOKEN_REPOSITORY_TOKEN',
);

export interface IEmailVerificationTokenRepository {
  create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<EmailVerificationTokenEntity>;

  findByTokenHash(tokenHash: string): Promise<EmailVerificationTokenEntity | null>;

  findLatestByUserId(userId: string): Promise<EmailVerificationTokenEntity | null>;

  invalidatePendingTokensForUser(userId: string): Promise<void>;

  consumeTokenAndVerifyUser(tokenHash: string, userId: string): Promise<boolean>;
}
