import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UpdateCompanyBranchRequestDto } from '@campusjob/contracts';

export class UpdateCompanyBranchDto implements UpdateCompanyBranchRequestDto {
  @ApiPropertyOptional({ description: 'Tên chi nhánh' })
  @IsOptional()
  @IsString({ message: 'Tên chi nhánh phải là chuỗi ký tự.' })
  branchName?: string;

  @ApiPropertyOptional({ description: 'Địa chỉ chi tiết' })
  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi ký tự.' })
  addressLine?: string;

  @ApiPropertyOptional({ description: 'Phường/Xã' })
  @IsOptional()
  @IsString()
  ward?: string | null;

  @ApiPropertyOptional({ description: 'Quận/Huyện' })
  @IsOptional()
  @IsString()
  district?: string | null;

  @ApiPropertyOptional({ description: 'Tỉnh/Thành phố' })
  @IsOptional()
  @IsString({ message: 'Thành phố phải là chuỗi ký tự.' })
  city?: string;

  @ApiPropertyOptional({ description: 'Quốc gia' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại chi nhánh' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ description: 'Email liên hệ chi nhánh' })
  @IsOptional()
  @IsEmail({}, { message: 'Email chi nhánh không hợp lệ.' })
  email?: string | null;

  @ApiPropertyOptional({
    description: 'Vĩ độ tọa độ địa lý (-90 đến 90)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'Vĩ độ (latitude) phải là một số thực.' })
  @Min(-90, { message: 'Vĩ độ (latitude) phải nằm trong khoảng từ -90 đến 90.' })
  @Max(90, { message: 'Vĩ độ (latitude) phải nằm trong khoảng từ -90 đến 90.' })
  latitude?: number | null;

  @ApiPropertyOptional({
    description: 'Kinh độ tọa độ địa lý (-180 đến 180)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'Kinh độ (longitude) phải là một số thực.' })
  @Min(-180, { message: 'Kinh độ (longitude) phải nằm trong khoảng từ -180 đến 180.' })
  @Max(180, { message: 'Kinh độ (longitude) phải nằm trong khoảng từ -180 đến 180.' })
  longitude?: number | null;

  @ApiPropertyOptional({ description: 'Có phải trụ sở chính hay không' })
  @IsOptional()
  @IsBoolean()
  isHeadquarter?: boolean;
}
