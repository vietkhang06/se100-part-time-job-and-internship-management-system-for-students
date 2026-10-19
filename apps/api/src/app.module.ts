import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';

import { DatabaseModule } from './shared/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { StudentsModule } from './modules/students/students.module';
import { RequestIdMiddleware } from './shared/middleware/request-id.middleware';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { StorageModule } from './shared/storage/storage.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SanctionsModule } from './modules/sanctions/sanctions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(__dirname, '../../../.env'),
      ],
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    StudentsModule,
    NotificationsModule,
    StorageModule,
    ModerationModule,
    ReportsModule,
    SanctionsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}