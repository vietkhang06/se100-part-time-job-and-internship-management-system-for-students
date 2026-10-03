import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { PASSWORD_POLICY } from '../../infrastructure/security/password-hasher';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6...',
    description: 'Raw password reset token sent via email',
  })
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token!: string;

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
