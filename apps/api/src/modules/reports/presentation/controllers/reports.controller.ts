import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  PaginatedResponse,
  UserRole,
  ViolationReportDetailDto,
  ViolationReportDto,
} from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import {
  CreateViolationReportDto,
  ListMyReportsQueryDto,
} from '../../application/dto/violation-report.dto';
import { CreateViolationReportUseCase } from '../../application/use-cases/create-violation-report.use-case';
import { ListMyReportsUseCase } from '../../application/use-cases/list-my-reports.use-case';
import { GetReportUseCase } from '../../application/use-cases/get-report.use-case';

@ApiTags('Violation Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly createReport: CreateViolationReportUseCase,
    private readonly listMyReports: ListMyReportsUseCase,
    private readonly getReport: GetReportUseCase,
  ) {}

  @Post()
  @Roles(UserRole.STUDENT, UserRole.EMPLOYER)
  @ApiOperation({ summary: 'UC49 — Gửi báo cáo vi phạm' })
  @ApiResponse({ status: 409, description: 'REPORT_DUPLICATE' })
  @ApiResponse({ status: 404, description: 'REPORT_TARGET_NOT_FOUND' })
  async create(
    @CurrentUser() user: { id: string; role: UserRole },
    @Body() body: CreateViolationReportDto,
  ): Promise<ViolationReportDto> {
    return this.createReport.execute(user, body);
  }

  @Get('mine')
  @Roles(UserRole.STUDENT, UserRole.EMPLOYER)
  @ApiOperation({ summary: 'UC48 — Xem các báo cáo tôi đã gửi' })
  async mine(
    @CurrentUser('id') userId: string,
    @Query() query: ListMyReportsQueryDto,
  ): Promise<PaginatedResponse<ViolationReportDto>> {
    return this.listMyReports.execute(userId, query.page, query.limit);
  }

  @Get('review/:id')
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'UC52 — Xem đầy đủ báo cáo và bằng chứng để thẩm tra' })
  async forReview(@Param('id', new ParseUUIDPipe()) id: string): Promise<ViolationReportDetailDto> {
    return this.getReport.forReview(id);
  }

  @Get(':id')
  @Roles(UserRole.STUDENT, UserRole.EMPLOYER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chi tiết một báo cáo của tôi' })
  async detail(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ViolationReportDto> {
    return this.getReport.forReporter(id, userId);
  }
}
