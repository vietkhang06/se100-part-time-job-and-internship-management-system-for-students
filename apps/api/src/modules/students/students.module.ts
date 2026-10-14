import { Module } from '@nestjs/common';
import { StudentsController } from './presentation/controllers/students.controller';
import { CvsController } from './presentation/controllers/cvs.controller';
import { GetStudentProfileUseCase } from './application/use-cases/get-student-profile.use-case';
import { UpdateStudentProfileUseCase } from './application/use-cases/update-student-profile.use-case';
import { ListCvsUseCase } from './application/use-cases/list-cvs.use-case';
import { GetCvDetailUseCase } from './application/use-cases/get-cv-detail.use-case';
import { CreateCvUseCase } from './application/use-cases/create-cv.use-case';
import { UpdateCvUseCase } from './application/use-cases/update-cv.use-case';
import { SetDefaultCvUseCase } from './application/use-cases/set-default-cv.use-case';
import { DeleteCvUseCase } from './application/use-cases/delete-cv.use-case';
import { PrismaStudentProfileRepository } from './infrastructure/persistence/prisma-student-profile.repository';
import { STUDENT_PROFILE_REPOSITORY_TOKEN } from './domain/repositories/student-profile.repository.interface';
import { PrismaCvRepository } from './infrastructure/persistence/prisma-cv.repository';
import { CV_REPOSITORY_TOKEN } from './domain/repositories/cv.repository.interface';

/**
 * StudentsModule (M02 – Student Profile & CV Management)
 *
 * Vertical slice: Quản lý toàn bộ Hồ sơ sinh viên và CV (UC11–UC12, UC31–UC35)
 */
@Module({
  controllers: [StudentsController, CvsController],
  providers: [
    // Profile Use Cases
    GetStudentProfileUseCase,
    UpdateStudentProfileUseCase,
    // CV Use Cases (UC31–UC35 / CV01–CV05)
    ListCvsUseCase,
    GetCvDetailUseCase,
    CreateCvUseCase,
    UpdateCvUseCase,
    SetDefaultCvUseCase,
    DeleteCvUseCase,
    // Repository bindings
    {
      provide: STUDENT_PROFILE_REPOSITORY_TOKEN,
      useClass: PrismaStudentProfileRepository,
    },
    {
      provide: CV_REPOSITORY_TOKEN,
      useClass: PrismaCvRepository,
    },
  ],
  exports: [GetStudentProfileUseCase, GetCvDetailUseCase, ListCvsUseCase],
})
export class StudentsModule {}

