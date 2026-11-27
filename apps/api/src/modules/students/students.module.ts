import { Module } from '@nestjs/common';
import { MailModule } from '../../shared/mail/mail.module';
import { StudentsController } from './presentation/controllers/students.controller';
import { CvsController } from './presentation/controllers/cvs.controller';
import { GetStudentProfileUseCase } from './application/use-cases/get-student-profile.use-case';
import { UpdateStudentProfileUseCase } from './application/use-cases/update-student-profile.use-case';
import { RequestCampusVerificationUseCase } from './application/use-cases/request-campus-verification.use-case';
import { ConfirmCampusVerificationUseCase } from './application/use-cases/confirm-campus-verification.use-case';
import { GetCvSnapshotUseCase } from './application/use-cases/get-cv-snapshot.use-case';
import { ListCvsUseCase } from './application/use-cases/list-cvs.use-case';
import { GetCvDetailUseCase } from './application/use-cases/get-cv-detail.use-case';
import { CreateCvUseCase } from './application/use-cases/create-cv.use-case';
import { UpdateCvUseCase } from './application/use-cases/update-cv.use-case';
import { SetDefaultCvUseCase } from './application/use-cases/set-default-cv.use-case';
import { DeleteCvUseCase } from './application/use-cases/delete-cv.use-case';
import { UploadCvFileUseCase } from './application/use-cases/upload-cv-file.use-case';
import { DownloadCvFileUseCase } from './application/use-cases/download-cv-file.use-case';
import { PrismaStudentProfileRepository } from './infrastructure/persistence/prisma-student-profile.repository';
import { PrismaCampusVerificationRepository } from './infrastructure/persistence/prisma-campus-verification.repository';
import { PrismaCvRepository } from './infrastructure/persistence/prisma-cv.repository';
import {
  CvSnapshotSourceAdapter,
  CV_SNAPSHOT_SOURCE_TOKEN,
} from './infrastructure/adapters/cv-snapshot-source.adapter';
import { STUDENT_PROFILE_REPOSITORY_TOKEN } from './domain/repositories/student-profile.repository.interface';
import { CAMPUS_VERIFICATION_REPOSITORY_TOKEN } from './domain/repositories/campus-verification.repository.interface';
import { CV_REPOSITORY_TOKEN } from './domain/repositories/cv.repository.interface';

/**
 * StudentsModule (M02 – Student Profile & CV Management)
 *
 * Vertical slice: Quản lý toàn bộ Hồ sơ sinh viên, xác thực email trường (COND-M02-01) và CV (UC11–UC12, UC31–UC35)
 * Cung cấp Snapshot CV cho Module M04 khi sinh viên nộp hồ sơ (Contract C-03 / UC37–UC38)
 */
@Module({
  imports: [MailModule],
  controllers: [StudentsController, CvsController],
  providers: [
    // Profile & Campus Verification Use Cases
    GetStudentProfileUseCase,
    UpdateStudentProfileUseCase,
    RequestCampusVerificationUseCase,
    ConfirmCampusVerificationUseCase,

    // CV Use Cases (UC31–UC35 / CV01–CV05)
    ListCvsUseCase,
    GetCvDetailUseCase,
    CreateCvUseCase,
    UpdateCvUseCase,
    SetDefaultCvUseCase,
    DeleteCvUseCase,
    UploadCvFileUseCase,
    DownloadCvFileUseCase,

    // Snapshot Use Cases & Adapters (UC37–UC38 / Contract C-03)
    GetCvSnapshotUseCase,
    CvSnapshotSourceAdapter,

    // Repository bindings
    {
      provide: STUDENT_PROFILE_REPOSITORY_TOKEN,
      useClass: PrismaStudentProfileRepository,
    },
    {
      provide: CAMPUS_VERIFICATION_REPOSITORY_TOKEN,
      useClass: PrismaCampusVerificationRepository,
    },
    {
      provide: CV_REPOSITORY_TOKEN,
      useClass: PrismaCvRepository,
    },

    // Contract C-03 binding: token → adapter
    {
      provide: CV_SNAPSHOT_SOURCE_TOKEN,
      useExisting: CvSnapshotSourceAdapter,
    },
  ],
  exports: [
    GetStudentProfileUseCase,
    GetCvDetailUseCase,
    ListCvsUseCase,
    UploadCvFileUseCase,
    DownloadCvFileUseCase,
    GetCvSnapshotUseCase,
    CvSnapshotSourceAdapter,
    CV_SNAPSHOT_SOURCE_TOKEN,
  ],
})
export class StudentsModule {}