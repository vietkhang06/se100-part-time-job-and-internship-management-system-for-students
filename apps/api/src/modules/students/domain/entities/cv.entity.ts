import {
  EducationItemDto,
  ExperienceItemDto,
  ProjectItemDto,
  CertificationItemDto,
} from '@campusjob/contracts';

/**
 * Domain Entity đại diện cho CV của sinh viên (Module M02)
 */
export class CvEntity {
  constructor(
    public readonly id: string,
    public readonly studentProfileId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly summary: string | null = null,
    public readonly isDefault: boolean = false,
    public readonly fileUrl: string | null = null,
    public readonly skills: string[] = [],
    public readonly educations: EducationItemDto[] = [],
    public readonly experiences: ExperienceItemDto[] = [],
    public readonly projects: ProjectItemDto[] = [],
    public readonly certifications: CertificationItemDto[] = [],
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {}
}
