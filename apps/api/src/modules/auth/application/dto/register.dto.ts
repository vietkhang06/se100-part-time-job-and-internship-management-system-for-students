import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsIn,
  IsOptional,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '@campusjob/contracts';
import { PASSWORD_POLICY } from '../../infrastructure/security/password-hasher';

export class RegisterDto {
  @ApiProperty({ example: 'student@example.com', description: 'User email address' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'Password satisfying complexity policy',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(PASSWORD_POLICY.REGEX, {
    message: PASSWORD_POLICY.MESSAGE,
  })
  password!: string;

  @ApiProperty({ example: 'Nguyen Van A', description: 'Full name' })
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  fullName!: string;

  @ApiProperty({
    enum: [UserRole.STUDENT, UserRole.EMPLOYER],
    example: UserRole.STUDENT,
    description: 'Role for self-registration (STUDENT or EMPLOYER only)',
  })
  @IsEnum(UserRole)
  @IsIn([UserRole.STUDENT, UserRole.EMPLOYER], {
    message: 'Only STUDENT and EMPLOYER roles are permitted for self-registration',
  })
  role!: UserRole.STUDENT | UserRole.EMPLOYER;

  @ApiProperty({ example: '0901234567', required: false, description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;
}
