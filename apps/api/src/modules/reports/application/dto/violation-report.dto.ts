import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ViolationReason, ViolationTargetType } from '@campusjob/contracts';
import { MAX_EVIDENCE_PER_REPORT } from '../../domain/policies/report-rules.policy';

export class EvidenceInputDto {
  @ApiProperty({ example: 'https://example.com/screenshot.png' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreateViolationReportDto {
  @ApiProperty({ enum: ViolationTargetType })
  @IsEnum(ViolationTargetType)
  targetType!: ViolationTargetType;

  @ApiProperty({ description: 'Id của đối tượng bị báo cáo' })
  @IsUUID()
  targetId!: string;

  @ApiProperty({ enum: ViolationReason })
  @IsEnum(ViolationReason)
  reason!: ViolationReason;

  @ApiProperty({ minLength: 20, maxLength: 2000 })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional({ type: [EvidenceInputDto], maxItems: MAX_EVIDENCE_PER_REPORT })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EVIDENCE_PER_REPORT)
  @ValidateNested({ each: true })
  @Type(() => EvidenceInputDto)
  evidence?: EvidenceInputDto[];
}

export class ListMyReportsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
