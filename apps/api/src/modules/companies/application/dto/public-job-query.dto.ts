import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobType } from '@campusjob/contracts';

export class PublicJobQueryDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tiêu đề hoặc mô tả công việc' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ngành nghề' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Lọc theo địa điểm (thành phố chi nhánh)' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Lọc theo địa điểm (bí danh cho city)' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ enum: JobType, description: 'Lọc theo loại hình công việc' })
  @IsOptional()
  @IsEnum(JobType)
  type?: JobType;

  @ApiPropertyOptional({ description: 'Mức lương tối thiểu' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salaryMin?: number;

  @ApiPropertyOptional({ description: 'Mức lương tối đa' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salaryMax?: number;

  @ApiPropertyOptional({ description: 'Lọc theo lịch làm việc' })
  @IsOptional()
  @IsString()
  schedule?: string;

  @ApiPropertyOptional({ description: 'Trang cần lấy (mặc định: 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng mỗi trang (mặc định: 10, tối đa: 50)', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
