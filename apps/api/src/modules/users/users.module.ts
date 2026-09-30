import { Module } from '@nestjs/common';
import { UsersController } from './presentation/controllers/users.controller';
import { GetUserByIdUseCase } from './application/use-cases/get-user-by-id.use-case';
import { USER_REPOSITORY_TOKEN } from './domain/repositories/user.repository.interface';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';

@Module({
  controllers: [UsersController],
  providers: [
    GetUserByIdUseCase,
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [USER_REPOSITORY_TOKEN, GetUserByIdUseCase],
})
export class UsersModule {}
