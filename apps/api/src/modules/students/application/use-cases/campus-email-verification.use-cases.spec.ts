import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JobSeekingStatus,
  StudentProfileErrorCode,
} from '@campusjob/contracts';
import { RequestCampusVerificationUseCase } from './request-campus-verification.use-case';
import { ConfirmCampusVerificationUseCase } from './confirm-campus-verification.use-case';
import { IStudentProfileRepository } from '../../domain/repositories/student-profile.repository.interface';
import { ICampusVerificationRepository } from '../../domain/repositories/campus-verification.repository.interface';
import { ICampusVerificationMailer } from '../../../../shared/mail/mail.service.interface';
import { StudentProfileEntity } from '../../domain/entities/student-profile.entity';
import { CampusEmailVerificationTokenEntity } from '../../domain/entities/campus-email-verification-token.entity';
import {
  CAMPUS_OTP_MAX_ATTEMPTS,
  CAMPUS_OTP_MAX_REQUESTS_PER_HOUR,
  hashCampusOtp,
} from '../../domain/services/campus-email-policy';

describe('Campus Email Verification Use Cases (COND-M02-01)', () => {
  let profileRepo: jest.Mocked<IStudentProfileRepository>;
  let verificationRepo: jest.Mocked<ICampusVerificationRepository>;
  let campusMailer: jest.Mocked<ICampusVerificationMailer>;
  let configService: ConfigService;

  let requestUseCase: RequestCampusVerificationUseCase;
  let confirmUseCase: ConfirmCampusVerificationUseCase;

  const makeProfile = (
    overrides?: Partial<StudentProfileEntity>,
  ): StudentProfileEntity =>
    new StudentProfileEntity(
      overrides?.id ?? 'profile-1',
      overrides?.userId ?? 'user-1',
      overrides?.fullName ?? 'Nguyễn Văn A',
      overrides?.email ?? 'student@gmail.com',
      overrides?.phone ?? '0901234567',
      overrides?.avatarUrl ?? null,
      overrides?.university ?? 'ĐH CNTT',
      overrides?.major ?? 'KTPM',
      overrides?.graduationYear ?? 2026,
      overrides?.jobSeekingStatus ?? JobSeekingStatus.ACTIVELY_LOOKING,
      overrides?.bio ?? null,
      overrides?.skills ?? ['TypeScript'],
      overrides?.isCampusVerified ?? false,
      overrides?.campusEmail ?? null,
      overrides?.createdAt ?? new Date('2026-10-12T00:00:00.000Z'),
      overrides?.updatedAt ?? new Date('2026-10-12T00:00:00.000Z'),
    );

  beforeEach(() => {
    profileRepo = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByVerifiedCampusEmail: jest.fn(),
      createOrFind: jest.fn(),
      updateByUserId: jest.fn(),
    };

    verificationRepo = {
      findLatestByProfileId: jest.fn(),
      findLatestByProfileAndEmail: jest.fn(),
      countRequestsSince: jest.fn(),
      createOtpAndInvalidatePending: jest.fn(),
      deleteTokenById: jest.fn(),
      incrementFailedAttempts: jest.fn(),
      consumeOtpAndVerifyProfile: jest.fn(),
    };

    campusMailer = {
      sendCampusVerificationOtpEmail: jest.fn().mockResolvedValue(undefined),
    };

    configService = new ConfigService({
      CAMPUS_OTP_SECRET: 'unit-test-campus-otp-secret',
      CAMPUS_EMAIL_ALLOWED_SUFFIXES: '.edu.vn',
    });

    requestUseCase = new RequestCampusVerificationUseCase(
      profileRepo,
      verificationRepo,
      campusMailer,
      configService,
    );
    confirmUseCase = new ConfirmCampusVerificationUseCase(
      profileRepo,
      verificationRepo,
      configService,
    );
  });

  describe('RequestCampusVerificationUseCase', () => {
    it('dispatches a 6-digit OTP to a valid .edu.vn email and hashes it before saving', async () => {
      const profile = makeProfile();
      profileRepo.createOrFind.mockResolvedValue(profile);
      profileRepo.findByVerifiedCampusEmail.mockResolvedValue(null);
      verificationRepo.findLatestByProfileId.mockResolvedValue(null);
      verificationRepo.countRequestsSince.mockResolvedValue(0);
      verificationRepo.createOtpAndInvalidatePending.mockImplementation(
        async (data) =>
          new CampusEmailVerificationTokenEntity(
            'token-1',
            data.studentProfileId,
            data.campusEmail,
            data.otpHash,
            0,
            data.maxAttempts,
            data.expiresAt,
            null,
            new Date(),
          ),
      );

      const res = await requestUseCase.execute('user-1', {
        campusEmail: ' 21520001@GM.UIT.EDU.VN ',
      });

      expect(res.campusEmail).toBe('21520001@gm.uit.edu.vn');
      expect(res.resendCooldownSeconds).toBe(60);
      expect(verificationRepo.createOtpAndInvalidatePending).toHaveBeenCalledTimes(1);
      const savedArgs =
        verificationRepo.createOtpAndInvalidatePending.mock.calls[0][0];
      expect(savedArgs.campusEmail).toBe('21520001@gm.uit.edu.vn');
      expect(savedArgs.otpHash).toMatch(/^[a-f0-9]{64}$/);

      expect(campusMailer.sendCampusVerificationOtpEmail).toHaveBeenCalledWith(
        '21520001@gm.uit.edu.vn',
        expect.stringMatching(/^\d{6}$/),
        10,
      );
      const dispatchedOtp =
        campusMailer.sendCampusVerificationOtpEmail.mock.calls[0][1];
      expect(savedArgs.otpHash).not.toBe(dispatchedOtp);
    });

    it('rejects disallowed domains with CAMPUS_EMAIL_DOMAIN_NOT_ALLOWED', async () => {
      await expect(
        requestUseCase.execute('user-1', { campusEmail: 'student@gmail.com' }),
      ).rejects.toThrow(BadRequestException);

      try {
        await requestUseCase.execute('user-1', {
          campusEmail: 'student@uit.edu.vn.evil.com',
        });
      } catch (err) {
        const response = (err as BadRequestException).getResponse() as Record<
          string,
          unknown
        >;
        expect(response.code).toBe(
          StudentProfileErrorCode.CAMPUS_EMAIL_DOMAIN_NOT_ALLOWED,
        );
      }
    });

    it('rejects when another student has already verified the same campus email (409)', async () => {
      profileRepo.createOrFind.mockResolvedValue(makeProfile({ id: 'profile-1' }));
      profileRepo.findByVerifiedCampusEmail.mockResolvedValue(
        makeProfile({
          id: 'profile-2',
          userId: 'user-2',
          isCampusVerified: true,
          campusEmail: '21520001@gm.uit.edu.vn',
        }),
      );

      await expect(
        requestUseCase.execute('user-1', {
          campusEmail: '21520001@gm.uit.edu.vn',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('enforces 60s resend cooldown and hourly request limit with HTTP 429', async () => {
      profileRepo.createOrFind.mockResolvedValue(makeProfile());
      profileRepo.findByVerifiedCampusEmail.mockResolvedValue(null);
      verificationRepo.findLatestByProfileId.mockResolvedValue(
        new CampusEmailVerificationTokenEntity(
          'token-recent',
          'profile-1',
          '21520001@gm.uit.edu.vn',
          'hash',
          0,
          CAMPUS_OTP_MAX_ATTEMPTS,
          new Date(Date.now() + 500_000),
          null,
          new Date(Date.now() - 15_000), // 15s ago (< 60s cooldown)
        ),
      );

      await expect(
        requestUseCase.execute('user-1', {
          campusEmail: '21520001@gm.uit.edu.vn',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });

      // Past cooldown but reached hourly limit
      verificationRepo.findLatestByProfileId.mockResolvedValue(
        new CampusEmailVerificationTokenEntity(
          'token-old',
          'profile-1',
          '21520001@gm.uit.edu.vn',
          'hash',
          0,
          CAMPUS_OTP_MAX_ATTEMPTS,
          new Date(Date.now() + 500_000),
          null,
          new Date(Date.now() - 120_000),
        ),
      );
      verificationRepo.countRequestsSince.mockResolvedValue(
        CAMPUS_OTP_MAX_REQUESTS_PER_HOUR,
      );

      await expect(
        requestUseCase.execute('user-1', {
          campusEmail: '21520001@gm.uit.edu.vn',
        }),
      ).rejects.toThrow(HttpException);
    });

    it('cleans up token and throws 503 if SMTP delivery fails', async () => {
      profileRepo.createOrFind.mockResolvedValue(makeProfile());
      profileRepo.findByVerifiedCampusEmail.mockResolvedValue(null);
      verificationRepo.findLatestByProfileId.mockResolvedValue(null);
      verificationRepo.countRequestsSince.mockResolvedValue(0);
      verificationRepo.createOtpAndInvalidatePending.mockResolvedValue(
        new CampusEmailVerificationTokenEntity(
          'token-unsent',
          'profile-1',
          '21520001@gm.uit.edu.vn',
          'hash',
          0,
          CAMPUS_OTP_MAX_ATTEMPTS,
          new Date(Date.now() + 600_000),
          null,
          new Date(),
        ),
      );
      verificationRepo.deleteTokenById.mockResolvedValue(undefined);
      campusMailer.sendCampusVerificationOtpEmail.mockRejectedValue(
        new Error('SMTP connection refused'),
      );

      await expect(
        requestUseCase.execute('user-1', {
          campusEmail: '21520001@gm.uit.edu.vn',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(verificationRepo.deleteTokenById).toHaveBeenCalledWith(
        'token-unsent',
      );
    });
  });

  describe('ConfirmCampusVerificationUseCase', () => {
    it('verifies valid OTP atomically and returns updated verified StudentProfileDto', async () => {
      const otp = '482913';
      const email = '21520001@gm.uit.edu.vn';
      const otpHash = hashCampusOtp({
        studentProfileId: 'profile-1',
        campusEmail: email,
        otp,
        secret: 'unit-test-campus-otp-secret',
      });

      profileRepo.createOrFind
        .mockResolvedValueOnce(makeProfile())
        .mockResolvedValueOnce(
          makeProfile({ isCampusVerified: true, campusEmail: email }),
        );
      profileRepo.findByVerifiedCampusEmail.mockResolvedValue(null);
      verificationRepo.findLatestByProfileAndEmail.mockResolvedValue(
        new CampusEmailVerificationTokenEntity(
          'token-1',
          'profile-1',
          email,
          otpHash,
          0,
          CAMPUS_OTP_MAX_ATTEMPTS,
          new Date(Date.now() + 300_000),
          null,
          new Date(),
        ),
      );
      verificationRepo.consumeOtpAndVerifyProfile.mockResolvedValue('VERIFIED');

      const result = await confirmUseCase.execute('user-1', {
        campusEmail: email,
        otp,
      });

      expect(result.profile.isCampusVerified).toBe(true);
      expect(result.profile.campusEmail).toBe(email);
      expect(result.campusVerifiedAt).toBeDefined();
      expect(verificationRepo.consumeOtpAndVerifyProfile).toHaveBeenCalledTimes(1);
    });

    it('rejects expired OTP and does not verify profile', async () => {
      const otp = '482913';
      const email = '21520001@gm.uit.edu.vn';
      const otpHash = hashCampusOtp({
        studentProfileId: 'profile-1',
        campusEmail: email,
        otp,
        secret: 'unit-test-campus-otp-secret',
      });

      profileRepo.createOrFind.mockResolvedValue(makeProfile());
      profileRepo.findByVerifiedCampusEmail.mockResolvedValue(null);
      verificationRepo.findLatestByProfileAndEmail.mockResolvedValue(
        new CampusEmailVerificationTokenEntity(
          'token-expired',
          'profile-1',
          email,
          otpHash,
          0,
          CAMPUS_OTP_MAX_ATTEMPTS,
          new Date(Date.now() - 10_000),
          null,
          new Date(Date.now() - 700_000),
        ),
      );

      await expect(
        confirmUseCase.execute('user-1', { campusEmail: email, otp }),
      ).rejects.toThrow(BadRequestException);
      expect(verificationRepo.consumeOtpAndVerifyProfile).not.toHaveBeenCalled();
    });

    it('rejects already-used OTP (reuse attack prevention)', async () => {
      const otp = '482913';
      const email = '21520001@gm.uit.edu.vn';
      const otpHash = hashCampusOtp({
        studentProfileId: 'profile-1',
        campusEmail: email,
        otp,
        secret: 'unit-test-campus-otp-secret',
      });

      profileRepo.createOrFind.mockResolvedValue(makeProfile());
      profileRepo.findByVerifiedCampusEmail.mockResolvedValue(null);
      verificationRepo.findLatestByProfileAndEmail.mockResolvedValue(
        new CampusEmailVerificationTokenEntity(
          'token-used',
          'profile-1',
          email,
          otpHash,
          0,
          CAMPUS_OTP_MAX_ATTEMPTS,
          new Date(Date.now() + 300_000),
          new Date(),
          new Date(),
        ),
      );

      await expect(
        confirmUseCase.execute('user-1', { campusEmail: email, otp }),
      ).rejects.toThrow(BadRequestException);
    });

    it('increments failed attempts on wrong OTP and locks with 429 at maxAttempts', async () => {
      const email = '21520001@gm.uit.edu.vn';
      const otpHash = hashCampusOtp({
        studentProfileId: 'profile-1',
        campusEmail: email,
        otp: '654321',
        secret: 'unit-test-campus-otp-secret',
      });

      profileRepo.createOrFind.mockResolvedValue(makeProfile());
      profileRepo.findByVerifiedCampusEmail.mockResolvedValue(null);
      verificationRepo.findLatestByProfileAndEmail.mockResolvedValue(
        new CampusEmailVerificationTokenEntity(
          'token-1',
          'profile-1',
          email,
          otpHash,
          4,
          CAMPUS_OTP_MAX_ATTEMPTS,
          new Date(Date.now() + 300_000),
          null,
          new Date(),
        ),
      );
      verificationRepo.incrementFailedAttempts.mockResolvedValue(
        new CampusEmailVerificationTokenEntity(
          'token-1',
          'profile-1',
          email,
          otpHash,
          5,
          CAMPUS_OTP_MAX_ATTEMPTS,
          new Date(Date.now() + 300_000),
          new Date(),
          new Date(),
        ),
      );

      await expect(
        confirmUseCase.execute('user-1', { campusEmail: email, otp: '000000' }),
      ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
      expect(verificationRepo.incrementFailedAttempts).toHaveBeenCalledWith(
        'token-1',
      );
    });
  });
});

