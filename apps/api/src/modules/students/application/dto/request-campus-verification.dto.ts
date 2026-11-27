import { ApiProperty } from '@nestjs/swagger';
import { RequestCampusVerificationRequestDto } from '@campusjob/contracts';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RequestCampusVerificationDto
  implements RequestCampusVerificationRequestDto
{
  @ApiProperty({
    example: '21520001@gm.uit.edu.vn',
    description: 'Địa chỉ email trường đại học của sinh viên (.edu.vn)',
  })
  @IsString({ message: 'Email trường phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ email trường.' })
  @IsEmail({}, { message: 'Địa chỉ email trường không đúng định dạng.' })
  @MaxLength(254, { message: 'Địa chỉ email không được vượt quá 254 ký tự.' })
  campusEmail!: string;
}

