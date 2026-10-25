import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
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
import { ReviewsModule } from './modules/reviews/reviews.module';
import { CompaniesModule } from './modules/companies/companies.module';
import {
  M04Module,
  M04_CV_SOURCE,
  M04_JOB_SOURCE,
} from './modules/applications/m04.module';
import { CvSnapshotSourceAdapter } from './modules/students/infrastructure/adapters/cv-snapshot-source.adapter';
import { JobAccessSourceAdapter } from './modules/companies/infrastructure/adapters/job-access-source.adapter';

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
    ReviewsModule,
    CompaniesModule,
    M04Module.register(
      {
        provide: M04_CV_SOURCE,
        useFactory: (moduleRef: ModuleRef) =>
          moduleRef.get(CvSnapshotSourceAdapter, { strict: false }),
        inject: [ModuleRef],
      },
      {
        provide: M04_JOB_SOURCE,
        useFactory: (moduleRef: ModuleRef) =>
          moduleRef.get(JobAccessSourceAdapter, { strict: false }),
        inject: [ModuleRef],
      },
    ),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}
