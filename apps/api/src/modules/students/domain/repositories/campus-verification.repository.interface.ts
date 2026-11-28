import { CampusEmailVerificationTokenEntity } from '../entities/campus-email-verification-token.entity';

export const CAMPUS_VERIFICATION_REPOSITORY_TOKEN = Symbol(
  'CAMPUS_VERIFICATION_REPOSITORY_TOKEN',
);

export type ConsumeCampusOtpResult =
  | 'VERIFIED'
  | 'TOKEN_INVALID_OR_CONSUMED'
  | 'EMAIL_ALREADY_IN_USE';

export interface ICampusVerificationRepository {
  findLatestByProfileId(
    studentProfileId: string,
  ): Promise<CampusEmailVerificationTokenEntity | null>;

  findLatestByProfileAndEmail(
    studentProfileId: string,
    campusEmail: string,
  ): Promise<CampusEmailVerificationTokenEntity | null>;

  countRequestsSince(
    studentProfileId: string,
    since: Date,
  ): Promise<number>;

  createOtpAndInvalidatePending(data: {
    studentProfileId: string;
    campusEmail: string;
    otpHash: string;
    expiresAt: Date;
    maxAttempts: number;
  }): Promise<CampusEmailVerificationTokenEntity>;

  deleteTokenById(tokenId: string): Promise<void>;

  incrementFailedAttempts(
    tokenId: string,
  ): Promise<CampusEmailVerificationTokenEntity | null>;

  consumeOtpAndVerifyProfile(params: {
    tokenId: string;
    studentProfileId: string;
    userId: string;
    campusEmail: string;
    now: Date;
    maxAttempts: number;
  }): Promise<ConsumeCampusOtpResult>;
}

