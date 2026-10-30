import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CreateCompanyRequestDto,
  DocumentType,
  VerificationDocumentAttachmentInput,
} from '@campusjob/contracts';

export class VerificationDocumentAttachmentDto
  implements VerificationDocumentAttachmentInput
{
  @ApiProperty({ description: 'ID của FileAsset đại diện cho tài liệu giấy phép' })
  @IsNotEmpty()
  @IsString()
  fileAssetId: string;

  @ApiPropertyOptional({
    enum: DocumentType,
    default: DocumentType.BUSINESS_LICENSE,
    description: 'Loại tài liệu giấy phép',
  })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;
}

export class CreateCompanyDto implements CreateCompanyRequestDto {
  @ApiProperty({ description: 'Tên thương hiệu doanh nghiệp', example: 'FPT Software' })
  @IsNotEmpty({ message: 'Tên doanh nghiệp không được để trống.' })
  @IsString({ message: 'Tên doanh nghiệp phải là chuỗi ký tự.' })
  name: string;

  @ApiPropertyOptional({ description: 'Tên pháp lý đầy đủ', example: 'Công ty Cổ phần FPT' })
  @IsOptional()
  @IsString()
  legalName?: string | null;

  @ApiPropertyOptional({ description: 'Người đại diện pháp luật', example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  representativeName?: string | null;

  @ApiProperty({ description: 'Mã số thuế doanh nghiệp (Duy nhất)', example: '0101248141' })
  @IsNotEmpty({ message: 'Mã số thuế không được để trống.' })
  @IsString({ message: 'Mã số thuế phải là chuỗi ký tự.' })
  taxId: string;

  @ApiPropertyOptional({ description: 'Website chính thức', example: 'https://fpt-software.com' })
  @IsOptional()
  @IsUrl({}, { message: 'Website phải là một URL hợp lệ.' })
  website?: string | null;

  @ApiPropertyOptional({ description: 'Lĩnh vực hoạt động', example: 'Công nghệ thông tin' })
  @IsOptional()
  @IsString()
  industry?: string | null;

  @ApiPropertyOptional({ description: 'Quy mô công ty', example: '1000+' })
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

  @ApiPropertyOptional({ description: 'Email liên hệ chính', example: 'contact@fpt.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Email liên hệ không đúng định dạng.' })
  email?: string | null;

  @ApiPropertyOptional({ description: 'Số điện thoại liên hệ chính', example: '02473007575' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ description: 'Địa chỉ trụ sở chính', example: 'Tòa nhà FPT, Cầu Giấy, Hà Nội' })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({
    description: 'Danh sách tài liệu giấy phép lưu qua FileAsset',
    type: [VerificationDocumentAttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerificationDocumentAttachmentDto)
  documents?: VerificationDocumentAttachmentDto[];
}
