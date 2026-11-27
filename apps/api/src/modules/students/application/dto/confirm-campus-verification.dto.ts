import { ApiProperty } from '@nestjs/swagger';
import { ConfirmCampusVerificationRequestDto } from '@campusjob/contracts';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ConfirmCampusVerificationDto
  implements ConfirmCampusVerificationRequestDto
{
  @ApiProperty({
    example: '21520001@gm.uit.edu.vn',
    description: 'Địa chỉ email trường đã yêu cầu gửi OTP',
  })
  @IsString({ message: 'Email trường phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ email trường.' })
  @IsEmail({}, { message: 'Địa chỉ email trường không đúng định dạng.' })
  @MaxLength(254, { message: 'Địa chỉ email không được vượt quá 254 ký tự.' })
  campusEmail!: string;

  @ApiProperty({
    example: '123456',
    description: 'Mã OTP gồm đúng 6 chữ số nhận từ email trường',
  })
  @IsString({ message: 'Mã OTP phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Vui lòng nhập mã OTP.' })
  @Matches(/^\d{6}$/, { message: 'Mã OTP phải gồm đúng 6 chữ số.' })
  otp!: string;
}

