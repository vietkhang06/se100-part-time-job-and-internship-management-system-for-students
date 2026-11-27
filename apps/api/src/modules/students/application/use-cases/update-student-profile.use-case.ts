import { Injectable, Inject } from '@nestjs/common';
import {
  StudentProfileResponseDto,
  UpdateStudentProfileRequestDto,
} from '@campusjob/contracts';
import {
  STUDENT_PROFILE_REPOSITORY_TOKEN,
  IStudentProfileRepository,
} from '../../domain/repositories/student-profile.repository.interface';
import { mapStudentProfileToDto } from '../dto/student-profile.mapper';

@Injectable()
export class UpdateStudentProfileUseCase {
  constructor(
    @Inject(STUDENT_PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepository: IStudentProfileRepository,
  ) {}

  /**
   * UC12 – Cập nhật hồ sơ sinh viên.
   * Chỉ sinh viên sở hữu tài khoản mới được cập nhật (ownership đã được đảm bảo
   * qua JwtAuthGuard + RolesGuard STUDENT ở controller; userId lấy từ JWT).
   */
  async execute(
    userId: string,
    data: UpdateStudentProfileRequestDto,
  ): Promise<StudentProfileResponseDto> {
    const updated = await this.profileRepository.updateByUserId(userId, data);
    return { profile: mapStudentProfileToDto(updated) };
  }
}
