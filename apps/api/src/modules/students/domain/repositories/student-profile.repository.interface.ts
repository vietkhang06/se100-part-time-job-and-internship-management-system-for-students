import { StudentProfileEntity } from '../entities/student-profile.entity';
import { JobSeekingStatus } from '@campusjob/contracts';

export const STUDENT_PROFILE_REPOSITORY_TOKEN = Symbol(
  'STUDENT_PROFILE_REPOSITORY_TOKEN',
);

export interface UpdateStudentProfileData {
  university?: string;
  major?: string;
  graduationYear?: number;
  jobSeekingStatus?: JobSeekingStatus;
  bio?: string;
  skills?: string[];
}

export interface IStudentProfileRepository {
  findById(id: string): Promise<StudentProfileEntity | null>;
  findByUserId(userId: string): Promise<StudentProfileEntity | null>;
  createOrFind(userId: string): Promise<StudentProfileEntity>;
  updateByUserId(
    userId: string,
    data: UpdateStudentProfileData,
  ): Promise<StudentProfileEntity>;
}
