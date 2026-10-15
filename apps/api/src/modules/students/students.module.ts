import { Module } from '@nestjs/common';
import { StudentsController } from './presentation/controllers/students.controller';
import { GetStudentProfileUseCase } from './application/use-cases/get-student-profile.use-case';
import { UpdateStudentProfileUseCase } from './application/use-cases/update-student-profile.use-case';
import { GetCvSnapshotUseCase } from './application/use-cases/get-cv-snapshot.use-case';
import { PrismaStudentProfileRepository } from './infrastructure/persistence/prisma-student-profile.repository';
import { InMemoryCvRepository } from './infrastructure/persistence/in-memory-cv.repository';
import {
  CvSnapshotSourceAdapter,
  CV_SNAPSHOT_SOURCE_TOKEN,
} from './infrastructure/adapters/cv-snapshot-source.adapter';
import { STUDENT_PROFILE_REPOSITORY_TOKEN } from './domain/repositories/student-profile.repository.interface';
import { CV_REPOSITORY_TOKEN } from './domain/repositories/cv.repository.interface';

/**
 * StudentsModule (M02 – Student Profile & CV)
 *
 * Cung cấp:
 *  - Quản lý hồ sơ sinh viên (UC11–UC12)
 *  - Cung cấp Snapshot CV cho Module M04 khi sinh viên nộp hồ sơ (Contract C-03 / UC37–UC38)
 */
@Module({
  controllers: [StudentsController],
  providers: [
    // Use Cases
    GetStudentProfileUseCase,
    UpdateStudentProfileUseCase,
    GetCvSnapshotUseCase,
    CvSnapshotSourceAdapter,
    // Repository binding: interface token → implementation
    {
      provide: STUDENT_PROFILE_REPOSITORY_TOKEN,
      useClass: PrismaStudentProfileRepository,
    },
    {
      provide: CV_REPOSITORY_TOKEN,
      useClass: InMemoryCvRepository,
    },
    // Contract C-03 binding: token → adapter
    {
      provide: CV_SNAPSHOT_SOURCE_TOKEN,
      useExisting: CvSnapshotSourceAdapter,
    },
  ],
  exports: [
    GetStudentProfileUseCase,
    GetCvSnapshotUseCase,
    CvSnapshotSourceAdapter,
    CV_SNAPSHOT_SOURCE_TOKEN,
  ],
})
export class StudentsModule {}

