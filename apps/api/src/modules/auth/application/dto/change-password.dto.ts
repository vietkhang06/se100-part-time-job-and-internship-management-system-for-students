import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { PASSWORD_POLICY } from '../../infrastructure/security/password-hasher';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldSecurePass123!',
    description: 'Current password for verification',
  })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword!: string;

  @ApiProperty({
    example: 'NewSecurePass123!',
    description: 'New password satisfying complexity policy',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(PASSWORD_POLICY.REGEX, {
    message: PASSWORD_POLICY.MESSAGE,
  })
  newPassword!: string;
}
