import { CvEntity } from '../entities/cv.entity';
import {
  CertificationItemDto,
  EducationItemDto,
  ExperienceItemDto,
  ProjectItemDto,
} from '@campusjob/contracts';

export const CV_REPOSITORY_TOKEN = Symbol('CV_REPOSITORY_TOKEN');

export interface CreateCvData {
  studentProfileId: string;
  title: string;
  summary?: string | null;
  isDefault?: boolean;
  fileUrl?: string | null;
  fileAssetId?: string | null;
  skills?: string[];
  educations?: EducationItemDto[];
  experiences?: ExperienceItemDto[];
  projects?: ProjectItemDto[];
  certifications?: CertificationItemDto[];
}

export interface UpdateCvData {
  title?: string;
  summary?: string | null;
  isDefault?: boolean;
  fileUrl?: string | null;
  fileAssetId?: string | null;
  skills?: string[];
  educations?: EducationItemDto[];
  experiences?: ExperienceItemDto[];
  projects?: ProjectItemDto[];
  certifications?: CertificationItemDto[];
}

export interface ICvRepository {
  findByStudentProfileId(studentProfileId: string): Promise<CvEntity[]>;
  findById(id: string): Promise<CvEntity | null>;
  countByStudentProfileId(studentProfileId: string): Promise<number>;
  create(data: CreateCvData): Promise<CvEntity>;
  update(id: string, data: UpdateCvData): Promise<CvEntity>;
  setDefault(studentProfileId: string, cvId: string): Promise<void>;
  delete(id: string): Promise<void>;
  findDefaultByStudentProfileId(studentProfileId: string): Promise<CvEntity | null>;
  findLatestByStudentProfileId(
    studentProfileId: string,
    excludeId?: string,
  ): Promise<CvEntity | null>;
  isCvInUse(cvId: string): Promise<boolean>;
}
