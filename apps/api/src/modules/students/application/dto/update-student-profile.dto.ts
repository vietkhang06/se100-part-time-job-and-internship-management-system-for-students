import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  IsInt,
  Min,
  Max,
  IsEnum,
  MaxLength,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import {
  JobSeekingStatus,
  UpdateStudentProfileRequestDto,
} from '@campusjob/contracts';

export class UpdateStudentProfileDto implements UpdateStudentProfileRequestDto {
  @ApiPropertyOptional({
    example: 'Đại học Công nghệ Thông tin - ĐHQG TP.HCM',
    description: 'Tên trường đại học',
    minLength: 2,
    maxLength: 150,
  })
  @IsOptional()
  @IsString({ message: 'Tên trường đại học phải là chuỗi ký tự.' })
  @Length(2, 150, { message: 'Tên trường đại học phải từ 2 đến 150 ký tự.' })
  university?: string;

  @ApiPropertyOptional({
    example: 'Kỹ thuật Phần mềm',
    description: 'Chuyên ngành đào tạo',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Chuyên ngành đào tạo phải là chuỗi ký tự.' })
  @Length(2, 100, { message: 'Chuyên ngành đào tạo phải từ 2 đến 100 ký tự.' })
  major?: string;

  @ApiPropertyOptional({
    example: 2025,
    description: 'Năm tốt nghiệp dự kiến (2000 - 2035)',
  })
  @IsOptional()
  @IsInt({ message: 'Năm tốt nghiệp phải là số nguyên.' })
  @Min(2000, { message: 'Năm tốt nghiệp không thể nhỏ hơn năm 2000.' })
  @Max(2035, { message: 'Năm tốt nghiệp không thể vượt quá năm 2035.' })
  graduationYear?: number;

  @ApiPropertyOptional({
    enum: JobSeekingStatus,
    example: JobSeekingStatus.ACTIVELY_LOOKING,
    description: 'Trạng thái tìm kiếm việc làm của sinh viên',
  })
  @IsOptional()
  @IsEnum(JobSeekingStatus, {
    message:
      'Trạng thái tìm việc không hợp lệ. Chỉ chấp nhận: ACTIVELY_LOOKING, OPEN_FOR_OPPORTUNITIES, NOT_LOOKING.',
  })
  jobSeekingStatus?: JobSeekingStatus;

  @ApiPropertyOptional({
    example: 'Sinh viên năm cuối đam mê phát triển hệ thống web backend.',
    description: 'Tiểu sử tóm tắt bản thân',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Tiểu sử phải là chuỗi ký tự.' })
  @MaxLength(500, { message: 'Tiểu sử giới thiệu không được vượt quá 500 ký tự.' })
  bio?: string;

  @ApiPropertyOptional({
    example: ['TypeScript', 'NestJS', 'React', 'PostgreSQL'],
    description: 'Danh sách kỹ năng (tối đa 20 kỹ năng)',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Kỹ năng phải là một danh sách mảng.' })
  @ArrayMaxSize(20, { message: 'Danh sách kỹ năng tối đa 20 mục.' })
  @IsString({ each: true, message: 'Mỗi kỹ năng phải là một chuỗi ký tự.' })
  @MaxLength(50, { each: true, message: 'Mỗi kỹ năng không được vượt quá 50 ký tự.' })
  skills?: string[];
}
