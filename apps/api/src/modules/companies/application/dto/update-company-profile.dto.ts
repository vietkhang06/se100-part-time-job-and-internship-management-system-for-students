import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  IsUrl,
  IsEmail,
} from 'class-validator';
import { UpdateCompanyProfileRequestDto } from '@campusjob/contracts';

export class UpdateCompanyProfileDto implements UpdateCompanyProfileRequestDto {
  @ApiPropertyOptional({
    example: 'Công ty TNHH Giải pháp Công nghệ CampusJob',
    description: 'Tên thương hiệu doanh nghiệp',
    minLength: 2,
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Tên công ty phải là chuỗi ký tự.' })
  @Length(2, 255, { message: 'Tên công ty phải từ 2 đến 255 ký tự.' })
  name?: string;

  @ApiPropertyOptional({
    example: 'CÔNG TY TNHH GIẢI PHÁP CÔNG NGHỆ CAMPUSJOB VIỆT NAM',
    description: 'Tên pháp lý đầy đủ theo giấy phép kinh doanh',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Tên pháp lý phải là chuỗi ký tự.' })
  @MaxLength(255, { message: 'Tên pháp lý không được vượt quá 255 ký tự.' })
  legalName?: string | null;

  @ApiPropertyOptional({
    example: 'https://campusjob.vn',
    description: 'Website chính thức của doanh nghiệp',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Website không đúng định dạng URL.' })
  @MaxLength(255, { message: 'Địa chỉ website không được vượt quá 255 ký tự.' })
  website?: string | null;

  @ApiPropertyOptional({
    example: 'Công nghệ thông tin',
    description: 'Lĩnh vực hoạt động / Ngành nghề',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Ngành nghề phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Ngành nghề không được vượt quá 100 ký tự.' })
  industry?: string | null;

  @ApiPropertyOptional({
    example: '50-100 nhân viên',
    description: 'Quy mô công ty',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'Quy mô công ty phải là chuỗi ký tự.' })
  @MaxLength(50, { message: 'Quy mô công ty không được vượt quá 50 ký tự.' })
  companySize?: string | null;

  @ApiPropertyOptional({
    example: 'Doanh nghiệp tiên phong trong giải pháp tuyển dụng sinh viên.',
    description: 'Giới thiệu về doanh nghiệp',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString({ message: 'Mô tả giới thiệu phải là chuỗi ký tự.' })
  @MaxLength(2000, { message: 'Mô tả giới thiệu không được vượt quá 2000 ký tự.' })
  description?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.campusjob.vn/logos/company.png',
    description: 'Đường dẫn ảnh logo doanh nghiệp',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Logo URL không đúng định dạng URL.' })
  @MaxLength(500, { message: 'Đường dẫn logo không được vượt quá 500 ký tự.' })
  logoUrl?: string | null;

  @ApiPropertyOptional({
    example: 'contact@campusjob.vn',
    description: 'Email liên hệ của doanh nghiệp',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email liên hệ không đúng định dạng.' })
  @MaxLength(255, { message: 'Email không được vượt quá 255 ký tự.' })
  email?: string | null;

  @ApiPropertyOptional({
    example: '02812345678',
    description: 'Số điện thoại liên hệ chính thức',
  })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự.' })
  @MaxLength(20, { message: 'Số điện thoại không được vượt quá 20 ký tự.' })
  phone?: string | null;

  @ApiPropertyOptional({
    example: '123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    description: 'Địa chỉ trụ sở chính',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi ký tự.' })
  @MaxLength(255, { message: 'Địa chỉ không được vượt quá 255 ký tự.' })
  address?: string | null;
}
