import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConfirmCampusVerificationResponseDto,
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
  isAllowedCampusEmail,
  normalizeCampusEmail,
  parseCsvPolicyList,
  verifyCampusOtpHash,
} from '../../domain/services/campus-email-policy';
import { ConfirmCampusVerificationDto } from '../dto/confirm-campus-verification.dto';
import { mapStudentProfileToDto } from '../dto/student-profile.mapper';

@Injectable()
export class ConfirmCampusVerificationUseCase {
  private readonly logger = new Logger(ConfirmCampusVerificationUseCase.name);

  constructor(
    @Inject(STUDENT_PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepository: IStudentProfileRepository,
    @Inject(CAMPUS_VERIFICATION_REPOSITORY_TOKEN)
    private readonly verificationRepository: ICampusVerificationRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    userId: string,
    dto: ConfirmCampusVerificationDto,
  ): Promise<ConfirmCampusVerificationResponseDto> {
    const normalizedEmail = normalizeCampusEmail(dto.campusEmail);
    const otp = (dto.otp ?? '').trim();

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

    if (!/^\d{6}$/.test(otp)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Mã OTP phải gồm đúng 6 chữ số.',
        error: 'Bad Request',
        code: StudentProfileErrorCode.CAMPUS_OTP_INVALID,
      });
    }

    const profile = await this.profileRepository.createOrFind(userId);

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

    const token =
      await this.verificationRepository.findLatestByProfileAndEmail(
        profile.id,
        normalizedEmail,
      );

    if (!token || token.isUsed()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Mã OTP không chính xác hoặc đã được sử dụng.',
        error: 'Bad Request',
        code: StudentProfileErrorCode.CAMPUS_OTP_INVALID,
      });
    }

    const now = new Date();
    if (token.isExpired(now)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu gửi mã mới.',
        error: 'Bad Request',
        code: StudentProfileErrorCode.CAMPUS_OTP_EXPIRED,
      });
    }

    if (token.hasReachedMaxAttempts()) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Bạn đã nhập sai mã OTP quá số lần quy định. Vui lòng yêu cầu gửi mã mới.',
          error: 'Too Many Requests',
          code: StudentProfileErrorCode.CAMPUS_OTP_MAX_ATTEMPTS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otpSecret = this.configService.get<string>('CAMPUS_OTP_SECRET');
    const isMatch = verifyCampusOtpHash({
      studentProfileId: profile.id,
      campusEmail: normalizedEmail,
      otp,
      expectedHash: token.otpHash,
      secret: otpSecret,
    });

    if (!isMatch) {
      const updated = await this.verificationRepository.incrementFailedAttempts(
        token.id,
      );
      if (updated && updated.hasReachedMaxAttempts()) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              'Bạn đã nhập sai mã OTP quá số lần quy định. Vui lòng yêu cầu gửi mã mới.',
            error: 'Too Many Requests',
            code: StudentProfileErrorCode.CAMPUS_OTP_MAX_ATTEMPTS,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new BadRequestException({
        statusCode: 400,
        message: 'Mã OTP không chính xác hoặc đã được sử dụng.',
        error: 'Bad Request',
        code: StudentProfileErrorCode.CAMPUS_OTP_INVALID,
      });
    }

    const outcome =
      await this.verificationRepository.consumeOtpAndVerifyProfile({
        tokenId: token.id,
        studentProfileId: profile.id,
        userId,
        campusEmail: normalizedEmail,
        now,
        maxAttempts: token.maxAttempts,
      });

    if (outcome === 'EMAIL_ALREADY_IN_USE') {
      throw new ConflictException({
        statusCode: 409,
        message:
          'Email trường này đã được liên kết với một tài khoản sinh viên khác.',
        error: 'Conflict',
        code: StudentProfileErrorCode.CAMPUS_EMAIL_ALREADY_IN_USE,
      });
    }

    if (outcome === 'TOKEN_INVALID_OR_CONSUMED') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Mã OTP không chính xác hoặc đã được sử dụng.',
        error: 'Bad Request',
        code: StudentProfileErrorCode.CAMPUS_OTP_INVALID,
      });
    }

    const verifiedProfile = await this.profileRepository.createOrFind(userId);
    this.logger.log(
      `Campus email ${normalizedEmail} verified for profile ${profile.id}`,
    );

    return {
      message: 'Xác thực email trường thành công.',
      campusVerifiedAt: now.toISOString(),
      profile: mapStudentProfileToDto(verifiedProfile),
    };
  }
}

