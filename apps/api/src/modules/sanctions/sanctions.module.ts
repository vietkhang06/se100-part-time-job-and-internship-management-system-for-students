import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsModule } from '../reports/reports.module';
import { SanctionsController } from './presentation/controllers/sanctions.controller';
import { SANCTION_REPOSITORY_TOKEN } from './domain/repositories/sanction.repository.interface';
import { PrismaSanctionRepository } from './infrastructure/persistence/prisma-sanction.repository';
import { CompanySanctionHandlerRegistry } from './application/ports/company-sanction-handler.port';
import { SANCTION_QUERY_TOKEN } from './application/ports/sanction-query.port';
import { SanctionQueryService } from './application/use-cases/sanction-query.service';
import { ApplySanctionUseCase } from './application/use-cases/apply-sanction.use-case';
import { CloseReportWithoutSanctionUseCase } from './application/use-cases/close-report-without-sanction.use-case';
import { LiftSanctionUseCase } from './application/use-cases/lift-sanction.use-case';
import {
  GetSanctionUseCase,
  ListMySanctionsUseCase,
  ListReportsForVerdictUseCase,
  ListSanctionsUseCase,
} from './application/use-cases/sanction-queries.use-cases';

@Module({
  imports: [DatabaseModule, UsersModule, NotificationsModule, ReportsModule],
  controllers: [SanctionsController],
  providers: [
    CompanySanctionHandlerRegistry,
    ApplySanctionUseCase,
    CloseReportWithoutSanctionUseCase,
    LiftSanctionUseCase,
    ListReportsForVerdictUseCase,
    ListSanctionsUseCase,
    GetSanctionUseCase,
    ListMySanctionsUseCase,
    SanctionQueryService,
    { provide: SANCTION_QUERY_TOKEN, useExisting: SanctionQueryService },
    { provide: SANCTION_REPOSITORY_TOKEN, useClass: PrismaSanctionRepository },
  ],
  // M04 inject SANCTION_QUERY_TOKEN để chặn nộp hồ sơ khi sinh viên bị khóa; M03 đăng ký handler đình chỉ doanh nghiệp.
  exports: [SANCTION_QUERY_TOKEN, CompanySanctionHandlerRegistry],
})
export class SanctionsModule {}
