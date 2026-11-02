import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import {
  UserRole,
  AdminJobMetricsResponseDto,
  JobMetricsDto,
} from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { GetAdminJobMetricsUseCase } from '../../application/use-cases/get-admin-job-metrics.use-case';

/**
 * AdminJobsController
 *
 * S6-M03-01: Cung cấp số liệu thống kê lượt xem và lượt lưu tin cho Quản trị viên (Admin only).
 */
@ApiTags('Admin Job Metrics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/jobs')
export class AdminJobsController {
  constructor(
    private readonly getAdminJobMetricsUseCase: GetAdminJobMetricsUseCase,
  ) {}

  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'S6-M03-01 — Thống kê tổng hợp lượt xem/lưu toàn hệ thống cho Quản trị viên',
  })
  @ApiResponse({ status: 200, description: 'Dữ liệu thống kê tổng hợp' })
  async getAggregateMetrics(): Promise<AdminJobMetricsResponseDto> {
    return this.getAdminJobMetricsUseCase.executeAggregate();
  }

  @Get(':jobId/metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'S6-M03-01 — Thống kê chi tiết lượt xem/lưu của một tin cho Quản trị viên',
  })
  @ApiParam({ name: 'jobId', description: 'ID tin tuyển dụng' })
  @ApiResponse({ status: 200, description: 'Dữ liệu thống kê tin' })
  @ApiResponse({ status: 404, description: 'Tin không tồn tại' })
  async getSingleMetrics(
    @Param('jobId') jobId: string,
  ): Promise<JobMetricsDto> {
    return this.getAdminJobMetricsUseCase.executeSingle(jobId);
  }
}
