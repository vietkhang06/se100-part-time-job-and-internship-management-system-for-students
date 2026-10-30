import { IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CompanyVerificationStatus,
  UpdateCompanyVerificationStatusRequestDto,
} from '@campusjob/contracts';

export class UpdateCompanyVerificationStatusDto
  implements UpdateCompanyVerificationStatusRequestDto
{
  @ApiProperty({
    enum: CompanyVerificationStatus,
    description: 'Trạng thái xác thực mới (VERIFIED hoặc REJECTED)',
    example: CompanyVerificationStatus.VERIFIED,
  })
  @IsNotEmpty({ message: 'Trạng thái xác thực không được để trống.' })
  @IsEnum(CompanyVerificationStatus, {
    message: 'Trạng thái xác thực không hợp lệ.',
  })
  status: CompanyVerificationStatus;

  @ApiPropertyOptional({
    description: 'Lý do từ chối (Bắt buộc nếu chuyển sang trạng thái REJECTED)',
    example: 'Giấy phép kinh doanh đã hết hạn hoặc không khớp mã số thuế.',
  })
  @IsOptional()
  @IsString({ message: 'Lý do từ chối phải là chuỗi ký tự.' })
  rejectionReason?: string | null;
}
