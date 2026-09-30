import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus, AuthUserDto } from '@campusjob/contracts';

export class UserResponseDto implements AuthUserDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'student@example.com' })
  email: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.STUDENT })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
