import { JobSeekingStatus } from '@campusjob/contracts';

export class StudentProfileEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly fullName: string,
    public readonly email: string,
    public readonly phone?: string | null,
    public readonly avatarUrl?: string | null,
    public readonly university?: string | null,
    public readonly major?: string | null,
    public readonly graduationYear?: number | null,
    public readonly jobSeekingStatus: JobSeekingStatus = JobSeekingStatus.ACTIVELY_LOOKING,
    public readonly bio?: string | null,
    public readonly skills: string[] = [],
    public readonly isCampusVerified: boolean = false,
    public readonly campusEmail?: string | null,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
  ) {}
}
