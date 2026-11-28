import { StudentProfileDto } from '@campusjob/contracts';
import { StudentProfileEntity } from '../../domain/entities/student-profile.entity';

/** Maps domain StudentProfileEntity to public StudentProfileDto. */
export function mapStudentProfileToDto(
  entity: StudentProfileEntity,
): StudentProfileDto {
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

