import {
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UpdateCompanyProfileRequestDto } from '@campusjob/contracts';
import { VerificationDocumentAttachmentDto } from './create-company.dto';

export class UpdateCompanyProfileDto implements UpdateCompanyProfileRequestDto {
  @ApiPropertyOptional({ description: 'Tên thương hiệu doanh nghiệp' })
  @IsOptional()
  @IsString({ message: 'Tên doanh nghiệp phải là chuỗi ký tự.' })
  name?: string;

  @ApiPropertyOptional({ description: 'Tên pháp lý đầy đủ' })
  @IsOptional()
  @IsString()
  legalName?: string | null;

  @ApiPropertyOptional({ description: 'Người đại diện pháp luật' })
  @IsOptional()
  @IsString()
  representativeName?: string | null;

  @ApiPropertyOptional({ description: 'Website chính thức' })
  @IsOptional()
  @IsUrl({}, { message: 'Website phải là một URL hợp lệ.' })
  website?: string | null;

  @ApiPropertyOptional({ description: 'Lĩnh vực hoạt động' })
  @IsOptional()
  @IsString()
  industry?: string | null;

  @ApiPropertyOptional({ description: 'Quy mô công ty' })
  @IsOptional()
  @IsString()
  companySize?: string | null;

  @ApiPropertyOptional({ description: 'Mô tả tóm tắt về doanh nghiệp' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ description: 'URL ảnh logo doanh nghiệp' })
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Email liên hệ chính' })
  @IsOptional()
  @IsEmail({}, { message: 'Email liên hệ không đúng định dạng.' })
  email?: string | null;

  @ApiPropertyOptional({ description: 'Số điện thoại liên hệ chính' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ description: 'Địa chỉ trụ sở chính' })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({
    description: 'Danh sách tài liệu giấy phép bổ sung/thay thế lưu qua FileAsset',
    type: [VerificationDocumentAttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerificationDocumentAttachmentDto)
  documents?: VerificationDocumentAttachmentDto[];
}
