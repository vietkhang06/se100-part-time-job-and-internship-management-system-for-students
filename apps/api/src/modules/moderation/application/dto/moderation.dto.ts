import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ModerationDecisionType,
  ModerationStatus,
  ModerationTargetType,
} from '@campusjob/contracts';

export class ListModerationQueueQueryDto {
  @ApiPropertyOptional({ enum: ModerationStatus, default: ModerationStatus.PENDING })
  @IsOptional()
  @IsEnum(ModerationStatus)
  status: ModerationStatus = ModerationStatus.PENDING;

  @ApiPropertyOptional({ enum: ModerationTargetType })
  @IsOptional()
  @IsEnum(ModerationTargetType)
  targetType?: ModerationTargetType;

  @ApiPropertyOptional({ description: 'Chỉ lấy mục đã nhận về cho tôi' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  assignedToMe: boolean = false;

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

export class DecideModerationItemDto {
  @ApiProperty({ enum: ModerationDecisionType })
  @IsEnum(ModerationDecisionType)
  decision!: ModerationDecisionType;

  @ApiPropertyOptional({ description: 'Bắt buộc với REJECT, HIDE, SUBSTANTIATE, DISMISS' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional({ description: 'Chỉ cho báo cáo (UC52): đề xuất biện pháp xử lý' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  proposedAction?: string;
}
