import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { SanctionStatus, SanctionType } from '@campusjob/contracts';
import { MAX_LOCK_DAYS, MIN_LOCK_DAYS } from '../../domain/policies/sanction-rules.policy';

export class ApplySanctionDto {
  @ApiProperty({ description: 'Báo cáo đã có kết luận "có căn cứ" làm căn cứ chế tài' })
  @IsUUID()
  reportId!: string;

  @ApiProperty({ enum: SanctionType })
  @IsEnum(SanctionType)
  type!: SanctionType;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({ minimum: MIN_LOCK_DAYS, maximum: MAX_LOCK_DAYS, description: 'Chỉ với APPLICATION_LOCK' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_LOCK_DAYS)
  @Max(MAX_LOCK_DAYS)
  durationDays?: number;
}

export class ReasonDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}

export class ListSanctionsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: SanctionStatus })
  @IsOptional()
  @IsEnum(SanctionStatus)
  status?: SanctionStatus;

  @ApiPropertyOptional({ enum: SanctionType })
  @IsOptional()
  @IsEnum(SanctionType)
  type?: SanctionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetId?: string;
}
