import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  IsBoolean,
  Matches,
  IsUrl,
  IsNotEmpty,
} from 'class-validator';
import {
  EducationItemDto,
  ExperienceItemDto,
  ProjectItemDto,
  CertificationItemDto,
} from '@campusjob/contracts';

export class EducationItemDtoClass implements EducationItemDto {
  @ApiPropertyOptional({ example: 'ed1-5c74-4b53', description: 'ID định danh mục học vấn' })
  @IsOptional()
  @IsString({ message: 'ID học vấn phải là chuỗi ký tự.' })
  id?: string;

  @ApiProperty({
    example: 'Đại học Công nghệ Thông tin - ĐHQG TP.HCM',
    description: 'Tên trường học',
    minLength: 2,
    maxLength: 150,
  })
  @IsNotEmpty({ message: 'Tên trường học không được để trống.' })
  @IsString({ message: 'Tên trường học phải là chuỗi ký tự.' })
  @Length(2, 150, { message: 'Tên trường học phải từ 2 đến 150 ký tự.' })
  school: string;

  @ApiProperty({
    example: 'Kỹ thuật Phần mềm',
    description: 'Chuyên ngành đào tạo',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Chuyên ngành đào tạo không được để trống.' })
  @IsString({ message: 'Chuyên ngành đào tạo phải là chuỗi ký tự.' })
  @Length(2, 100, { message: 'Chuyên ngành đào tạo phải từ 2 đến 100 ký tự.' })
  major: string;

  @ApiProperty({
    example: '2021-09',
    description: 'Thời gian bắt đầu học (định dạng YYYY-MM)',
  })
  @IsNotEmpty({ message: 'Thời gian bắt đầu học không được để trống.' })
  @IsString({ message: 'Thời gian bắt đầu học phải là chuỗi ký tự.' })
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Thời gian bắt đầu học phải theo định dạng YYYY-MM (ví dụ 2021-09).',
  })
  startDate: string;

  @ApiPropertyOptional({
    example: '2025-06',
    description: 'Thời gian kết thúc học (định dạng YYYY-MM)',
  })
  @IsOptional()
  @IsString({ message: 'Thời gian kết thúc học phải là chuỗi ký tự.' })
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Thời gian kết thúc học phải theo định dạng YYYY-MM.',
  })
  endDate?: string | null;

  @ApiPropertyOptional({ example: true, description: 'Đang theo học tại trường' })
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái đang học phải là kiểu boolean.' })
  isCurrent?: boolean;

  @ApiPropertyOptional({ example: '3.52/4.0', description: 'Điểm trung bình tích lũy' })
  @IsOptional()
  @IsString({ message: 'Điểm GPA phải là chuỗi ký tự.' })
  @MaxLength(20, { message: 'Điểm GPA không được vượt quá 20 ký tự.' })
  gpa?: string | null;

  @ApiPropertyOptional({
    example: 'Chuyên ngành Công nghệ phần mềm doanh nghiệp, đạt học bổng.',
    description: 'Mô tả thêm về quá trình học',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Mô tả học vấn phải là chuỗi ký tự.' })
  @MaxLength(500, { message: 'Mô tả học vấn không được vượt quá 500 ký tự.' })
  description?: string | null;
}

export class ExperienceItemDtoClass implements ExperienceItemDto {
  @ApiPropertyOptional({ example: 'exp1-8d65-1d22', description: 'ID định danh mục kinh nghiệm' })
  @IsOptional()
  @IsString({ message: 'ID kinh nghiệm phải là chuỗi ký tự.' })
  id?: string;

  @ApiProperty({
    example: 'Công ty Cổ phần Công nghệ ABC',
    description: 'Tên công ty / tổ chức làm việc',
    minLength: 2,
    maxLength: 150,
  })
  @IsNotEmpty({ message: 'Tên công ty không được để trống.' })
  @IsString({ message: 'Tên công ty phải là chuỗi ký tự.' })
  @Length(2, 150, { message: 'Tên công ty phải từ 2 đến 150 ký tự.' })
  company: string;

  @ApiProperty({
    example: 'Thực tập sinh Backend',
    description: 'Vị trí công việc',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Vị trí làm việc không được để trống.' })
  @IsString({ message: 'Vị trí làm việc phải là chuỗi ký tự.' })
  @Length(2, 100, { message: 'Vị trí làm việc phải từ 2 đến 100 ký tự.' })
  position: string;

  @ApiProperty({
    example: '2024-06',
    description: 'Thời gian bắt đầu làm việc (định dạng YYYY-MM)',
  })
  @IsNotEmpty({ message: 'Thời gian bắt đầu làm việc không được để trống.' })
  @IsString({ message: 'Thời gian bắt đầu làm việc phải là chuỗi ký tự.' })
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Thời gian bắt đầu làm việc phải theo định dạng YYYY-MM.',
  })
  startDate: string;

  @ApiPropertyOptional({
    example: '2024-09',
    description: 'Thời gian kết thúc làm việc (định dạng YYYY-MM)',
  })
  @IsOptional()
  @IsString({ message: 'Thời gian kết thúc làm việc phải là chuỗi ký tự.' })
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Thời gian kết thúc làm việc phải theo định dạng YYYY-MM.',
  })
  endDate?: string | null;

  @ApiPropertyOptional({ example: false, description: 'Đang làm việc tại đây' })
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái đang làm việc phải là kiểu boolean.' })
  isCurrent?: boolean;

  @ApiPropertyOptional({
    example: 'Phát triển REST API bằng NestJS, tối ưu hóa truy vấn PostgreSQL.',
    description: 'Mô tả chi tiết công việc và đóng góp',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Mô tả kinh nghiệm phải là chuỗi ký tự.' })
  @MaxLength(1000, { message: 'Mô tả kinh nghiệm không được vượt quá 1000 ký tự.' })
  description?: string | null;
}

export class ProjectItemDtoClass implements ProjectItemDto {
  @ApiPropertyOptional({ example: 'prj1-6b4d-326f', description: 'ID định danh mục dự án' })
  @IsOptional()
  @IsString({ message: 'ID dự án phải là chuỗi ký tự.' })
  id?: string;

  @ApiProperty({
    example: 'Hệ thống Quản lý Việc làm CampusJob',
    description: 'Tên dự án',
    minLength: 2,
    maxLength: 150,
  })
  @IsNotEmpty({ message: 'Tên dự án không được để trống.' })
  @IsString({ message: 'Tên dự án phải là chuỗi ký tự.' })
  @Length(2, 150, { message: 'Tên dự án phải từ 2 đến 150 ký tự.' })
  name: string;

  @ApiPropertyOptional({ example: 'Backend Lead', description: 'Vai trò trong dự án', maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'Vai trò trong dự án phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Vai trò trong dự án không được vượt quá 100 ký tự.' })
  role?: string | null;

  @ApiPropertyOptional({ example: '2026-09', description: 'Thời gian bắt đầu dự án' })
  @IsOptional()
  @IsString({ message: 'Thời gian bắt đầu dự án phải là chuỗi ký tự.' })
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Thời gian bắt đầu dự án phải theo định dạng YYYY-MM.',
  })
  startDate?: string | null;

  @ApiPropertyOptional({ example: '2026-10', description: 'Thời gian kết thúc dự án' })
  @IsOptional()
  @IsString({ message: 'Thời gian kết thúc dự án phải là chuỗi ký tự.' })
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Thời gian kết thúc dự án phải theo định dạng YYYY-MM.',
  })
  endDate?: string | null;

  @ApiPropertyOptional({ example: 'https://github.com/campusjob/core', description: 'Đường dẫn liên kết dự án' })
  @IsOptional()
  @IsString({ message: 'Liên kết dự án phải là chuỗi ký tự.' })
  @IsUrl({}, { message: 'Đường dẫn dự án phải là URL hợp lệ.' })
  @MaxLength(500, { message: 'Đường dẫn dự án không được vượt quá 500 ký tự.' })
  url?: string | null;

  @ApiPropertyOptional({
    example: 'Xây dựng kiến trúc Modular Monolith, phân quyền RBAC và quản lý CV.',
    description: 'Mô tả chi tiết dự án',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Mô tả dự án phải là chuỗi ký tự.' })
  @MaxLength(1000, { message: 'Mô tả dự án không được vượt quá 1000 ký tự.' })
  description?: string | null;
}

export class CertificationItemDtoClass implements CertificationItemDto {
  @ApiPropertyOptional({ example: 'crt1-7c5e-437a', description: 'ID định danh chứng chỉ' })
  @IsOptional()
  @IsString({ message: 'ID chứng chỉ phải là chuỗi ký tự.' })
  id?: string;

  @ApiProperty({
    example: 'AWS Certified Cloud Practitioner',
    description: 'Tên chứng chỉ',
    minLength: 2,
    maxLength: 150,
  })
  @IsNotEmpty({ message: 'Tên chứng chỉ không được để trống.' })
  @IsString({ message: 'Tên chứng chỉ phải là chuỗi ký tự.' })
  @Length(2, 150, { message: 'Tên chứng chỉ phải từ 2 đến 150 ký tự.' })
  name: string;

  @ApiProperty({
    example: 'Amazon Web Services',
    description: 'Đơn vị cấp chứng chỉ',
    minLength: 2,
    maxLength: 150,
  })
  @IsNotEmpty({ message: 'Đơn vị cấp chứng chỉ không được để trống.' })
  @IsString({ message: 'Đơn vị cấp chứng chỉ phải là chuỗi ký tự.' })
  @Length(2, 150, { message: 'Đơn vị cấp chứng chỉ phải từ 2 đến 150 ký tự.' })
  issuer: string;

  @ApiPropertyOptional({ example: '2024-05', description: 'Ngày cấp chứng chỉ (định dạng YYYY-MM)' })
  @IsOptional()
  @IsString({ message: 'Ngày cấp chứng chỉ phải là chuỗi ký tự.' })
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Ngày cấp chứng chỉ phải theo định dạng YYYY-MM.',
  })
  issueDate?: string | null;

  @ApiPropertyOptional({ example: 'https://aws.amazon.com/verification/example', description: 'Liên kết xác thực chứng chỉ' })
  @IsOptional()
  @IsString({ message: 'Liên kết chứng chỉ phải là chuỗi ký tự.' })
  @IsUrl({}, { message: 'Đường dẫn xác thực chứng chỉ phải là URL hợp lệ.' })
  @MaxLength(500, { message: 'Đường dẫn chứng chỉ không được vượt quá 500 ký tự.' })
  url?: string | null;
}
