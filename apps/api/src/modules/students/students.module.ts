import { Module } from '@nestjs/common';
import { StudentsController } from './presentation/controllers/students.controller';
import { GetStudentProfileUseCase } from './application/use-cases/get-student-profile.use-case';
import { UpdateStudentProfileUseCase } from './application/use-cases/update-student-profile.use-case';
import { PrismaStudentProfileRepository } from './infrastructure/persistence/prisma-student-profile.repository';
import { STUDENT_PROFILE_REPOSITORY_TOKEN } from './domain/repositories/student-profile.repository.interface';

/**
 * StudentsModule (M02 – Student Profile)
 *
 * Tại sao tách module riêng:
 *  - Vertical slice: mọi thứ liên quan profile sinh viên nằm ở đây.
 *  - PrismaService được DatabaseModule cung cấp globally nên không cần import lại.
 *  - STUDENT_PROFILE_REPOSITORY_TOKEN là DI token cho IStudentProfileRepository,
 *    giúp tách rời use-case khỏi Prisma (có thể swap implementation sau).
 */
@Module({
  controllers: [StudentsController],
  providers: [
    // Use Cases
    GetStudentProfileUseCase,
    UpdateStudentProfileUseCase,
    // Repository binding: interface token → Prisma implementation
    {
      provide: STUDENT_PROFILE_REPOSITORY_TOKEN,
      useClass: PrismaStudentProfileRepository,
    },
  ],
  exports: [GetStudentProfileUseCase],
})
export class StudentsModule {}
