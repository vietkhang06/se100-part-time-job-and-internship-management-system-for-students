import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '@campusjob/contracts';

export class JobPostingQueryDto {
  @ApiPropertyOptional({ enum: JobStatus, description: 'Lọc theo trạng thái tuyển dụng' })
  @IsOptional()
  @IsEnum(JobStatus, { message: 'Trạng thái tuyển dụng không hợp lệ' })
  status?: JobStatus;

  @ApiPropertyOptional({ description: 'Trang hiện tại (mặc định: 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang phải lớn hơn hoặc bằng 1' })
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng mỗi trang (mặc định: 20)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Giới hạn phải là số nguyên' })
  @Min(1, { message: 'Giới hạn phải lớn hơn hoặc bằng 1' })
  @Max(100, { message: 'Giới hạn tối đa là 100' })
  limit?: number = 20;
}
