import { IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationDocumentAttachmentDto } from './create-company.dto';

export class ResubmitVerificationDto {
  @ApiPropertyOptional({
    description: 'Danh sách tài liệu giấy phép nộp bổ sung/cập nhật qua FileAsset',
    type: [VerificationDocumentAttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerificationDocumentAttachmentDto)
  documents?: VerificationDocumentAttachmentDto[];
}
