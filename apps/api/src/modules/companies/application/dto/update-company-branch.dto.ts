import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  IsEmail,
  IsBoolean,
} from 'class-validator';
import { UpdateCompanyBranchRequestDto } from '@campusjob/contracts';

export class UpdateCompanyBranchDto implements UpdateCompanyBranchRequestDto {
  @ApiPropertyOptional({
    example: 'Chi nhánh Quận 1 (Cập nhật)',
    description: 'Tên định danh của chi nhánh',
    minLength: 2,
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Tên chi nhánh phải là chuỗi ký tự.' })
  @Length(2, 255, { message: 'Tên chi nhánh phải từ 2 đến 255 ký tự.' })
  branchName?: string;

  @ApiPropertyOptional({
    example: 'Tầng 12, Tòa nhà Bitexco, 2 Hải Triều',
    description: 'Địa chỉ chi tiết',
    minLength: 5,
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Địa chỉ chi nhánh phải là chuỗi ký tự.' })
  @Length(5, 255, { message: 'Địa chỉ chi nhánh phải từ 5 đến 255 ký tự.' })
  addressLine?: string;

  @ApiPropertyOptional({
    example: 'Phường Bến Nghé',
    description: 'Phường / Xã',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Phường/Xã phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Phường/Xã không được vượt quá 100 ký tự.' })
  ward?: string | null;

  @ApiPropertyOptional({
    example: 'Quận 1',
    description: 'Quận / Huyện / Thị xã',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Quận/Huyện phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Quận/Huyện không được vượt quá 100 ký tự.' })
  district?: string | null;

  @ApiPropertyOptional({
    example: 'Hồ Chí Minh',
    description: 'Tỉnh / Thành phố trực thuộc trung ương',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Tỉnh/Thành phố phải là chuỗi ký tự.' })
  @Length(2, 100, { message: 'Tỉnh/Thành phố phải từ 2 đến 100 ký tự.' })
  city?: string;

  @ApiPropertyOptional({
    example: 'Vietnam',
    description: 'Quốc gia',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Quốc gia phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Quốc gia không được vượt quá 100 ký tự.' })
  country?: string;

  @ApiPropertyOptional({
    example: '02838210000',
    description: 'Số điện thoại chi nhánh',
    maxLength: 20,
  })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự.' })
  @MaxLength(20, { message: 'Số điện thoại không được vượt quá 20 ký tự.' })
  phone?: string | null;

  @ApiPropertyOptional({
    example: 'branch.q1@campusjob.vn',
    description: 'Email liên hệ của chi nhánh',
    maxLength: 255,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email chi nhánh không đúng định dạng.' })
  @MaxLength(255, { message: 'Email chi nhánh không được vượt quá 255 ký tự.' })
  email?: string | null;

  @ApiPropertyOptional({
    example: false,
    description: 'Chi nhánh có phải là trụ sở chính không',
  })
  @IsOptional()
  @IsBoolean({ message: 'Trụ sở chính phải là giá trị boolean (true/false).' })
  isHeadquarter?: boolean;
}
