import { CvEntity } from '../entities/cv.entity';

export const CV_REPOSITORY_TOKEN = Symbol('CV_REPOSITORY_TOKEN');

export interface ICvRepository {
  findById(id: string): Promise<CvEntity | null>;
  findByStudentProfileId(studentProfileId: string): Promise<CvEntity[]>;
}
