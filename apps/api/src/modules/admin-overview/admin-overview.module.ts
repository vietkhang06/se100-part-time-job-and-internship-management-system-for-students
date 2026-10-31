import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { AdminOverviewController } from './presentation/controllers/admin-overview.controller';
import { GetAdminOverviewUseCase } from './application/use-cases/get-admin-overview.use-case';
import { OverviewSourceRegistry } from './application/ports/overview-source.port';
import { UsersOverviewSource } from './infrastructure/sources/users-overview.source';
import { ReportsOverviewSource } from './infrastructure/sources/reports-overview.source';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminOverviewController],
  providers: [OverviewSourceRegistry, GetAdminOverviewUseCase, UsersOverviewSource, ReportsOverviewSource],
  // M03 (COMPANIES, JOBS) và M04 (APPLICATIONS) inject OverviewSourceRegistry rồi register nguồn của mình.
  exports: [OverviewSourceRegistry],
})
export class AdminOverviewModule implements OnModuleInit {
  constructor(
    private readonly registry: OverviewSourceRegistry,
    private readonly users: UsersOverviewSource,
    private readonly reports: ReportsOverviewSource,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.users);
    this.registry.register(this.reports);
  }
}
