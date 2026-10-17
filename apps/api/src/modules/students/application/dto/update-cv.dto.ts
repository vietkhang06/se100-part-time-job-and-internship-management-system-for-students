import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsUrl,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateCvRequestDto } from '@campusjob/contracts';
import {
  EducationItemDtoClass,
  ExperienceItemDtoClass,
  ProjectItemDtoClass,
  CertificationItemDtoClass,
} from './cv-item.dto';

export class UpdateCvDto implements UpdateCvRequestDto {
  @ApiPropertyOptional({
    example: 'CV Lập trình viên Backend Senior',
    description: 'Tiêu đề của CV',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Tiêu đề CV phải là chuỗi ký tự.' })
  @Length(2, 100, { message: 'Tiêu đề CV phải từ 2 đến 100 ký tự.' })
  title?: string;

  @ApiPropertyOptional({
    example: 'Mục tiêu nghề nghiệp cập nhật...',
    description: 'Tóm tắt mục tiêu nghề nghiệp',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Tóm tắt mục tiêu phải là chuỗi ký tự.' })
  @MaxLength(1000, { message: 'Tóm tắt mục tiêu nghề nghiệp không được vượt quá 1000 ký tự.' })
  summary?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Đánh dấu CV mặc định',
  })
  @IsOptional()
  @IsBoolean({ message: 'Giá trị CV mặc định phải là true hoặc false.' })
  isDefault?: boolean;

  @ApiPropertyOptional({
    example: 'https://storage.campusjob.vn/cvs/updated.pdf',
    description: 'Đường dẫn tệp CV đính kèm',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Đường dẫn tệp CV phải là chuỗi ký tự.' })
  @IsUrl({}, { message: 'Đường dẫn tệp CV phải là URL hợp lệ.' })
  @MaxLength(500, { message: 'Đường dẫn tệp CV không được vượt quá 500 ký tự.' })
  fileUrl?: string | null;

  @ApiPropertyOptional({
    example: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    description: 'Định danh FileAsset liên kết',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Định danh FileAsset phải là UUID hợp lệ.' })
  fileAssetId?: string | null;

  @ApiPropertyOptional({
    example: ['TypeScript', 'NestJS', 'PostgreSQL', 'Docker', 'Kubernetes'],
    description: 'Danh sách kỹ năng (tối đa 30 kỹ năng)',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Kỹ năng phải là một danh sách mảng.' })
  @ArrayMaxSize(30, { message: 'Danh sách kỹ năng tối đa 30 mục.' })
  @IsString({ each: true, message: 'Mỗi kỹ năng phải là một chuỗi ký tự.' })
  @MaxLength(50, { each: true, message: 'Mỗi kỹ năng không được vượt quá 50 ký tự.' })
  skills?: string[];

  @ApiPropertyOptional({
    type: [EducationItemDtoClass],
    description: 'Danh sách học vấn (tối đa 10 mục)',
  })
  @IsOptional()
  @IsArray({ message: 'Học vấn phải là một danh sách mảng.' })
  @ArrayMaxSize(10, { message: 'Danh sách học vấn tối đa 10 mục.' })
  @ValidateNested({ each: true })
  @Type(() => EducationItemDtoClass)
  educations?: EducationItemDtoClass[];

  @ApiPropertyOptional({
    type: [ExperienceItemDtoClass],
    description: 'Danh sách kinh nghiệm làm việc (tối đa 10 mục)',
  })
  @IsOptional()
  @IsArray({ message: 'Kinh nghiệm phải là một danh sách mảng.' })
  @ArrayMaxSize(10, { message: 'Danh sách kinh nghiệm tối đa 10 mục.' })
  @ValidateNested({ each: true })
  @Type(() => ExperienceItemDtoClass)
  experiences?: ExperienceItemDtoClass[];

  @ApiPropertyOptional({
    type: [ProjectItemDtoClass],
    description: 'Danh sách dự án (tối đa 10 mục)',
  })
  @IsOptional()
  @IsArray({ message: 'Dự án phải là một danh sách mảng.' })
  @ArrayMaxSize(10, { message: 'Danh sách dự án tối đa 10 mục.' })
  @ValidateNested({ each: true })
  @Type(() => ProjectItemDtoClass)
  projects?: ProjectItemDtoClass[];

  @ApiPropertyOptional({
    type: [CertificationItemDtoClass],
    description: 'Danh sách chứng chỉ (tối đa 10 mục)',
  })
  @IsOptional()
  @IsArray({ message: 'Chứng chỉ phải là một danh sách mảng.' })
  @ArrayMaxSize(10, { message: 'Danh sách chứng chỉ tối đa 10 mục.' })
  @ValidateNested({ each: true })
  @Type(() => CertificationItemDtoClass)
  certifications?: CertificationItemDtoClass[];
}
