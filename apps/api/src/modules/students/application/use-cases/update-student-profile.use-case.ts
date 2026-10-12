import { Injectable, Inject } from '@nestjs/common';
import {
  StudentProfileResponseDto,
  StudentProfileDto,
  UpdateStudentProfileRequestDto,
} from '@campusjob/contracts';
import {
  STUDENT_PROFILE_REPOSITORY_TOKEN,
  IStudentProfileRepository,
} from '../../domain/repositories/student-profile.repository.interface';
import { StudentProfileEntity } from '../../domain/entities/student-profile.entity';

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
    return { profile: this.mapToDto(updated) };
  }

  private mapToDto(entity: StudentProfileEntity): StudentProfileDto {
    return {
      id: entity.id,
      userId: entity.userId,
      fullName: entity.fullName,
      email: entity.email,
      phone: entity.phone ?? null,
      avatarUrl: entity.avatarUrl ?? null,
      university: entity.university ?? null,
      major: entity.major ?? null,
      graduationYear: entity.graduationYear ?? null,
      jobSeekingStatus: entity.jobSeekingStatus,
      bio: entity.bio ?? null,
      skills: entity.skills,
      isCampusVerified: entity.isCampusVerified,
      campusEmail: entity.campusEmail ?? null,
      createdAt: entity.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: entity.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
