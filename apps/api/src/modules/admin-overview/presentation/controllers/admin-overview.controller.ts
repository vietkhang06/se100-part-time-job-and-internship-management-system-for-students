import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOverviewDto, UserRole } from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { GetAdminOverviewUseCase } from '../../application/use-cases/get-admin-overview.use-case';

@ApiTags('Admin Overview')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/overview')
export class AdminOverviewController {
  constructor(private readonly getOverview: GetAdminOverviewUseCase) {}

  @Get()
  @ApiOperation({ summary: 'UC54 — Tổng quan hệ thống (chỉ Quản trị viên)' })
  overview(): Promise<AdminOverviewDto> {
    return this.getOverview.execute();
  }
}
