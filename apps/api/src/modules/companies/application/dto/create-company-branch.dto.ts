import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateCompanyBranchRequestDto } from '@campusjob/contracts';

export class CreateCompanyBranchDto implements CreateCompanyBranchRequestDto {
  @ApiProperty({ description: 'Tên chi nhánh', example: 'Chi nhánh Quận 1' })
  @IsNotEmpty({ message: 'Tên chi nhánh không được để trống.' })
  @IsString({ message: 'Tên chi nhánh phải là chuỗi ký tự.' })
  branchName: string;

  @ApiProperty({ description: 'Địa chỉ chi tiết', example: '123 Nguyễn Huệ' })
  @IsNotEmpty({ message: 'Địa chỉ không được để trống.' })
  @IsString({ message: 'Địa chỉ phải là chuỗi ký tự.' })
  addressLine: string;

  @ApiPropertyOptional({ description: 'Phường/Xã', example: 'Bến Nghé' })
  @IsOptional()
  @IsString()
  ward?: string | null;

  @ApiPropertyOptional({ description: 'Quận/Huyện', example: 'Quận 1' })
  @IsOptional()
  @IsString()
  district?: string | null;

  @ApiProperty({ description: 'Tỉnh/Thành phố', example: 'Hồ Chí Minh' })
  @IsNotEmpty({ message: 'Thành phố không được để trống.' })
  @IsString({ message: 'Thành phố phải là chuỗi ký tự.' })
  city: string;

  @ApiPropertyOptional({ description: 'Quốc gia', default: 'Vietnam' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại chi nhánh', example: '0281234567' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ description: 'Email liên hệ chi nhánh', example: 'hcm-branch@fpt.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Email chi nhánh không hợp lệ.' })
  email?: string | null;

  @ApiPropertyOptional({
    description: 'Vĩ độ tọa độ địa lý (-90 đến 90)',
    example: 10.7769,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Vĩ độ (latitude) phải là một số thực.' })
  @Min(-90, { message: 'Vĩ độ (latitude) phải nằm trong khoảng từ -90 đến 90.' })
  @Max(90, { message: 'Vĩ độ (latitude) phải nằm trong khoảng từ -90 đến 90.' })
  latitude?: number | null;

  @ApiPropertyOptional({
    description: 'Kinh độ tọa độ địa lý (-180 đến 180)',
    example: 106.7009,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Kinh độ (longitude) phải là một số thực.' })
  @Min(-180, { message: 'Kinh độ (longitude) phải nằm trong khoảng từ -180 đến 180.' })
  @Max(180, { message: 'Kinh độ (longitude) phải nằm trong khoảng từ -180 đến 180.' })
  longitude?: number | null;

  @ApiPropertyOptional({ description: 'Có phải trụ sở chính hay không', default: false })
  @IsOptional()
  @IsBoolean()
  isHeadquarter?: boolean;
}
