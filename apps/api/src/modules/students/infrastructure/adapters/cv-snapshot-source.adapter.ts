import { Injectable } from '@nestjs/common';
import { CvSnapshotDto, CvSnapshotSource } from '@campusjob/contracts';
import { GetCvSnapshotUseCase } from '../../application/use-cases/get-cv-snapshot.use-case';

export const CV_SNAPSHOT_SOURCE_TOKEN = Symbol('CV_SNAPSHOT_SOURCE_TOKEN');

/**
 * Adapter phía M02 thực thi Contract C-03 (CvSnapshotSource)
 * Cung cấp Snapshot CV cho Module M04 khi sinh viên nộp hồ sơ (UC38)
 */
@Injectable()
export class CvSnapshotSourceAdapter implements CvSnapshotSource {
  constructor(private readonly getCvSnapshotUseCase: GetCvSnapshotUseCase) {}

  async getOwnedSnapshot(
    studentId: string,
    cvId: string,
  ): Promise<CvSnapshotDto> {
    return this.getCvSnapshotUseCase.execute(studentId, cvId);
  }
}
