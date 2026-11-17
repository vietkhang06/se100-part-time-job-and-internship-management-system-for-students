import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './presentation/controllers/users.controller';
import { AdminUsersController } from './presentation/controllers/admin-users.controller';
import { AdminUsersService } from './application/use-cases/admin-users.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { GetUserByIdUseCase } from './application/use-cases/get-user-by-id.use-case';
import { USER_REPOSITORY_TOKEN } from './domain/repositories/user.repository.interface';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';

@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule)],
  controllers: [UsersController, AdminUsersController],
  providers: [
    AdminUsersService,
    GetUserByIdUseCase,
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [USER_REPOSITORY_TOKEN, GetUserByIdUseCase],
})
export class UsersModule {}
