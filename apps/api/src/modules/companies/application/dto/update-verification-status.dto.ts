import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  CompanyVerificationStatus,
  UpdateCompanyVerificationStatusRequestDto,
} from '@campusjob/contracts';

export class UpdateCompanyVerificationStatusDto
  implements UpdateCompanyVerificationStatusRequestDto
{
  @ApiProperty({
    enum: CompanyVerificationStatus,
    example: CompanyVerificationStatus.VERIFIED,
    description: 'Trạng thái xác thực mới của doanh nghiệp',
  })
  @IsNotEmpty({ message: 'Trạng thái xác thực không được để trống.' })
  @IsEnum(CompanyVerificationStatus, {
    message:
      'Trạng thái không hợp lệ. Chỉ chấp nhận: UNVERIFIED, PENDING_REVIEW, VERIFIED, REJECTED.',
  })
  status: CompanyVerificationStatus;

  @ApiPropertyOptional({
    example: 'Giấy phép kinh doanh không khớp thông tin đăng ký.',
    description: 'Lý do từ chối (bắt buộc nếu chuyển sang REJECTED)',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Lý do từ chối phải là chuỗi ký tự.' })
  @MaxLength(1000, { message: 'Lý do từ chối không được vượt quá 1000 ký tự.' })
  rejectionReason?: string | null;
}
