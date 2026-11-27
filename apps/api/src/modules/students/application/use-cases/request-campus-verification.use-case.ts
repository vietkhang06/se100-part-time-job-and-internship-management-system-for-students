import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RequestCampusVerificationResponseDto,
  StudentProfileErrorCode,
} from '@campusjob/contracts';
import {
  IStudentProfileRepository,
  STUDENT_PROFILE_REPOSITORY_TOKEN,
} from '../../domain/repositories/student-profile.repository.interface';
import {
  CAMPUS_VERIFICATION_REPOSITORY_TOKEN,
  ICampusVerificationRepository,
} from '../../domain/repositories/campus-verification.repository.interface';
import {
  CAMPUS_VERIFICATION_MAILER_TOKEN,
  ICampusVerificationMailer,
} from '../../../../shared/mail/mail.service.interface';
import {
  CAMPUS_OTP_COOLDOWN_MS,
  CAMPUS_OTP_COOLDOWN_SECONDS,
  CAMPUS_OTP_MAX_ATTEMPTS,
  CAMPUS_OTP_MAX_REQUESTS_PER_HOUR,
  CAMPUS_OTP_TTL_MINUTES,
  CAMPUS_OTP_TTL_MS,
  generateNumericOtp,
  hashCampusOtp,
  isAllowedCampusEmail,
  normalizeCampusEmail,
  parseCsvPolicyList,
} from '../../domain/services/campus-email-policy';
import { RequestCampusVerificationDto } from '../dto/request-campus-verification.dto';

@Injectable()
export class RequestCampusVerificationUseCase {
  private readonly logger = new Logger(RequestCampusVerificationUseCase.name);

  constructor(
    @Inject(STUDENT_PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepository: IStudentProfileRepository,
    @Inject(CAMPUS_VERIFICATION_REPOSITORY_TOKEN)
    private readonly verificationRepository: ICampusVerificationRepository,
    @Inject(CAMPUS_VERIFICATION_MAILER_TOKEN)
    private readonly campusMailer: ICampusVerificationMailer,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    userId: string,
    dto: RequestCampusVerificationDto,
  ): Promise<RequestCampusVerificationResponseDto> {
    const normalizedEmail = normalizeCampusEmail(dto.campusEmail);
    const allowedSuffixes = parseCsvPolicyList(
      this.configService.get<string>('CAMPUS_EMAIL_ALLOWED_SUFFIXES'),
    );
    const allowedDomains = parseCsvPolicyList(
      this.configService.get<string>('CAMPUS_EMAIL_ALLOWED_DOMAINS'),
    );

    if (
      !isAllowedCampusEmail(normalizedEmail, {
        allowedSuffixes,
        allowedDomains,
      })
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message:
          'Chỉ chấp nhận email sinh viên thuộc tên miền trường đại học hợp lệ (.edu.vn).',
        error: 'Bad Request',
        code: StudentProfileErrorCode.CAMPUS_EMAIL_DOMAIN_NOT_ALLOWED,
      });
    }

    const profile = await this.profileRepository.createOrFind(userId);

    if (profile.isCampusVerified && profile.campusEmail === normalizedEmail) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Email trường này đã được xác thực cho hồ sơ của bạn.',
        error: 'Bad Request',
        code: StudentProfileErrorCode.CAMPUS_EMAIL_ALREADY_VERIFIED,
      });
    }

    const existingOwner =
      await this.profileRepository.findByVerifiedCampusEmail(normalizedEmail);
    if (existingOwner && existingOwner.id !== profile.id) {
      throw new ConflictException({
        statusCode: 409,
        message:
          'Email trường này đã được liên kết với một tài khoản sinh viên khác.',
        error: 'Conflict',
        code: StudentProfileErrorCode.CAMPUS_EMAIL_ALREADY_IN_USE,
      });
    }

    const nowMs = Date.now();
    const latestToken = await this.verificationRepository.findLatestByProfileId(
      profile.id,
    );
    if (latestToken) {
      const elapsed = nowMs - latestToken.createdAt.getTime();
      if (elapsed < CAMPUS_OTP_COOLDOWN_MS) {
        const remainingSec = Math.ceil(
          (CAMPUS_OTP_COOLDOWN_MS - elapsed) / 1000,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Vui lòng đợi ${remainingSec} giây trước khi yêu cầu gửi lại mã OTP.`,
            error: 'Too Many Requests',
            code: StudentProfileErrorCode.CAMPUS_OTP_RATE_LIMITED,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const oneHourAgo = new Date(nowMs - 60 * 60 * 1000);
    const recentCount = await this.verificationRepository.countRequestsSince(
      profile.id,
      oneHourAgo,
    );
    if (recentCount >= CAMPUS_OTP_MAX_REQUESTS_PER_HOUR) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Bạn đã yêu cầu gửi mã OTP quá số lần cho phép trong 1 giờ. Vui lòng thử lại sau.',
          error: 'Too Many Requests',
          code: StudentProfileErrorCode.CAMPUS_OTP_RATE_LIMITED,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otpCode = generateNumericOtp();
    const otpSecret = this.configService.get<string>('CAMPUS_OTP_SECRET');
    const otpHash = hashCampusOtp({
      studentProfileId: profile.id,
      campusEmail: normalizedEmail,
      otp: otpCode,
      secret: otpSecret,
    });
    const expiresAt = new Date(nowMs + CAMPUS_OTP_TTL_MS);

    const createdToken =
      await this.verificationRepository.createOtpAndInvalidatePending({
        studentProfileId: profile.id,
        campusEmail: normalizedEmail,
        otpHash,
        expiresAt,
        maxAttempts: CAMPUS_OTP_MAX_ATTEMPTS,
      });

    try {
      await this.campusMailer.sendCampusVerificationOtpEmail(
        normalizedEmail,
        otpCode,
        CAMPUS_OTP_TTL_MINUTES,
      );
    } catch (err: unknown) {
      // Best-effort cleanup so a transient mail outage does not lock the student into a cooldown
      await this.verificationRepository
        .deleteTokenById(createdToken.id)
        .catch((cleanupErr: unknown) => {
          this.logger.warn(
            `Failed to cleanup unsent campus OTP token ${createdToken.id}: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`,
          );
        });
      this.logger.error(
        `Campus OTP email delivery failed for profile ${profile.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException({
        statusCode: 503,
        message: 'Không thể gửi email xác thực lúc này. Vui lòng thử lại sau.',
        error: 'Service Unavailable',
        code: StudentProfileErrorCode.CAMPUS_EMAIL_DELIVERY_FAILED,
      });
    }

    this.logger.log(
      `Dispatched campus verification OTP for profile ${profile.id} (${normalizedEmail})`,
    );

    return {
      message:
        'Mã OTP xác thực email trường đã được gửi. Vui lòng kiểm tra hộp thư của bạn.',
      campusEmail: normalizedEmail,
      expiresAt: expiresAt.toISOString(),
      resendCooldownSeconds: CAMPUS_OTP_COOLDOWN_SECONDS,
    };
  }
}

