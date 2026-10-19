import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
  MAX_COMMENT_LENGTH,
  MAX_RATING,
  MAX_REPLY_LENGTH,
  MIN_RATING,
} from '../../domain/policies/review-rules.policy';

export class CreateReviewDto {
  @ApiProperty({ description: 'Hồ sơ ứng tuyển dùng làm căn cứ đánh giá' })
  @IsUUID()
  applicationId!: string;

  @ApiProperty({ minimum: MIN_RATING, maximum: MAX_RATING })
  @Type(() => Number)
  @IsInt()
  @Min(MIN_RATING)
  @Max(MAX_RATING)
  rating!: number;

  @ApiPropertyOptional({ maxLength: MAX_COMMENT_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  comment?: string;
}

export class ReplyReviewDto {
  @ApiProperty({ maxLength: MAX_REPLY_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_REPLY_LENGTH)
  content!: string;
}

export class ListReviewsQueryDto {
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
