import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AuthContext, AuthErrorCode, UserRole } from '@campusjob/contracts';
import { USER_REPOSITORY_TOKEN, IUserRepository } from '../../domain/repositories/user.repository.interface';
import { UserResponseDto } from '../dto/user-response.dto';

@Injectable()
export class GetUserByIdUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(id: string, requester: AuthContext): Promise<UserResponseDto> {
    if (requester.id !== id && requester.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        message: 'You may only view your own user profile.',
        code: AuthErrorCode.FORBIDDEN,
      });
    }

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id '${id}' not found`);
    }

    return new UserResponseDto({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      emailVerified: user.isVerified(),
    });
  }
}
