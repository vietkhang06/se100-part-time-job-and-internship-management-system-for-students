import {
  IsString,
  IsEnum,
  IsArray,
  IsInt,
  Min,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsISO8601,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobType, UpdateJobPostingRequestDto } from '@campusjob/contracts';

export class UpdateJobPostingDto implements UpdateJobPostingRequestDto {
  @ApiPropertyOptional({ description: 'ID của chi nhánh thuộc doanh nghiệp' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Tiêu đề tin tuyển dụng (FR-08)' })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Tiêu đề phải có ít nhất 3 ký tự' })
  @MaxLength(255, { message: 'Tiêu đề không được vượt quá 255 ký tự' })
  title?: string;

  @ApiPropertyOptional({ description: 'Mô tả công việc chi tiết (FR-08)' })
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Mô tả công việc phải có ít nhất 10 ký tự' })
  description?: string;

  @ApiPropertyOptional({ description: 'Ngành nghề (FR-08)' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ enum: JobType, description: 'Loại hình công việc (FR-08)' })
  @IsOptional()
  @IsEnum(JobType, { message: 'Loại hình công việc không hợp lệ' })
  type?: JobType;

  @ApiPropertyOptional({ type: [String], description: 'Yêu cầu kỹ năng (FR-08)' })
  @IsOptional()
  @IsArray({ message: 'Kỹ năng phải là danh sách chuỗi' })
  @IsString({ each: true, message: 'Mỗi kỹ năng phải là chuỗi' })
  skills?: string[];

  @ApiPropertyOptional({ description: 'Số lượng tuyển (FR-08)' })
  @IsOptional()
  @IsInt({ message: 'Số lượng tuyển phải là số nguyên' })
  @Min(1, { message: 'Số lượng tuyển phải ít nhất là 1' })
  quantity?: number;

  @ApiPropertyOptional({ description: 'Mô tả lương hiển thị (FR-08)' })
  @IsOptional()
  @IsString()
  salary?: string | null;

  @ApiPropertyOptional({ description: 'Mức lương tối thiểu (VND)' })
  @IsOptional()
  @IsNumber({}, { message: 'Mức lương tối thiểu phải là số' })
  @Min(0, { message: 'Mức lương tối thiểu không được âm' })
  salaryMin?: number | null;

  @ApiPropertyOptional({ description: 'Mức lương tối đa (VND)' })
  @IsOptional()
  @IsNumber({}, { message: 'Mức lương tối đa phải là số' })
  @Min(0, { message: 'Mức lương tối đa không được âm' })
  salaryMax?: number | null;

  @ApiPropertyOptional({ description: 'Lương thoả thuận' })
  @IsOptional()
  @IsBoolean()
  isSalaryNegotiable?: boolean;

  @ApiPropertyOptional({ description: 'Lịch làm việc / ca làm việc (FR-08)' })
  @IsOptional()
  @IsString()
  schedule?: string | null;

  @ApiPropertyOptional({ description: 'Quyền lợi ứng viên (FR-08)' })
  @IsOptional()
  @IsString()
  benefits?: string | null;

  @ApiPropertyOptional({ description: 'Hạn nộp hồ sơ (ISO-8601) (FR-08)' })
  @IsOptional()
  @IsISO8601({}, { message: 'Hạn nộp hồ sơ phải theo định dạng ngày ISO-8601 hợp lệ' })
  deadline?: string;
}
