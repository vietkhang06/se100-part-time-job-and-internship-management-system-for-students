import { Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ModerationTargetType, ViolationTargetType } from '@campusjob/contracts';
import { DatabaseModule } from '../../shared/database/database.module';
import { UsersModule } from '../users/users.module';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ModerationTargetHandlerRegistry } from '../moderation/application/ports/moderation-target-handler.port';
import { ReportsController } from './presentation/controllers/reports.controller';
import { VIOLATION_REPORT_REPOSITORY_TOKEN } from './domain/repositories/violation-report.repository.interface';
import { PrismaViolationReportRepository } from './infrastructure/persistence/prisma-violation-report.repository';
import { ReportTargetResolverRegistry } from './application/ports/report-target-resolver.port';
import { StudentReportTargetResolver } from './infrastructure/resolvers/student-report-target.resolver';
import { CreateViolationReportUseCase } from './application/use-cases/create-violation-report.use-case';
import { ListMyReportsUseCase } from './application/use-cases/list-my-reports.use-case';
import { GetReportUseCase } from './application/use-cases/get-report.use-case';
import { ReportModerationTargetHandler } from './application/use-cases/report-moderation-target.handler';
import { ReportAdminService } from './application/use-cases/report-admin.service';
import { REPORT_ADMIN_TOKEN } from './application/ports/report-admin.port';

@Module({
  imports: [DatabaseModule, UsersModule, ModerationModule, NotificationsModule],
  controllers: [ReportsController],
  providers: [
    ReportTargetResolverRegistry,
    StudentReportTargetResolver,
    ReportModerationTargetHandler,
    CreateViolationReportUseCase,
    ListMyReportsUseCase,
    GetReportUseCase,
    ReportAdminService,
    { provide: REPORT_ADMIN_TOKEN, useExisting: ReportAdminService },
    { provide: VIOLATION_REPORT_REPOSITORY_TOKEN, useClass: PrismaViolationReportRepository },
  ],
  // M03 (COMPANY, JOB) và M05-03 (REVIEW) inject ReportTargetResolverRegistry rồi register resolver của mình.
  // M05-04 (chế tài) dùng REPORT_ADMIN_TOKEN để xem báo cáo đã kết luận và đóng báo cáo sau phán quyết.
  exports: [ReportTargetResolverRegistry, REPORT_ADMIN_TOKEN],
})
export class ReportsModule implements OnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    const resolvers = this.moduleRef.get(ReportTargetResolverRegistry, { strict: false });
    resolvers.register(ViolationTargetType.STUDENT, this.moduleRef.get(StudentReportTargetResolver));

    const handlers = this.moduleRef.get(ModerationTargetHandlerRegistry, { strict: false });
    handlers.register(ModerationTargetType.REPORT, this.moduleRef.get(ReportModerationTargetHandler));
  }
}
