import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  PaginatedResponse,
  SanctionDetailDto,
  SanctionDto,
  UserRole,
  ViolationReportDetailDto,
} from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import {
  ApplySanctionDto,
  ListSanctionsQueryDto,
  PageQueryDto,
  ReasonDto,
} from '../../application/dto/sanction.dto';
import { ApplySanctionUseCase } from '../../application/use-cases/apply-sanction.use-case';
import { CloseReportWithoutSanctionUseCase } from '../../application/use-cases/close-report-without-sanction.use-case';
import { LiftSanctionUseCase } from '../../application/use-cases/lift-sanction.use-case';
import {
  GetSanctionUseCase,
  ListMySanctionsUseCase,
  ListReportsForVerdictUseCase,
  ListSanctionsUseCase,
} from '../../application/use-cases/sanction-queries.use-cases';

@ApiTags('Sanctions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sanctions')
export class SanctionsController {
  constructor(
    private readonly applySanction: ApplySanctionUseCase,
    private readonly closeReport: CloseReportWithoutSanctionUseCase,
    private readonly liftSanction: LiftSanctionUseCase,
    private readonly listReportsForVerdict: ListReportsForVerdictUseCase,
    private readonly listSanctions: ListSanctionsUseCase,
    private readonly getSanction: GetSanctionUseCase,
    private readonly listMySanctions: ListMySanctionsUseCase,
  ) {}

  @Get('reports')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'UC59 — Báo cáo đã có căn cứ, chờ Quản trị viên phán quyết' })
  reportsAwaitingVerdict(@Query() query: PageQueryDto): Promise<PaginatedResponse<ViolationReportDetailDto>> {
    return this.listReportsForVerdict.execute(query.page, query.limit);
  }

  @Post('reports/:reportId/close')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'UC59 — Phán quyết không xử phạt và đóng báo cáo' })
  close(
    @CurrentUser() admin: { id: string },
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() body: ReasonDto,
  ): Promise<{ reportId: string }> {
    return this.closeReport.execute(admin, reportId, body.reason);
  }

  @Get('mine')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Chế tài áp lên tài khoản của tôi (sinh viên)' })
  mine(@CurrentUser('id') studentId: string, @Query() query: PageQueryDto): Promise<PaginatedResponse<SanctionDto>> {
    return this.listMySanctions.execute(studentId, query.page, query.limit);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Lịch sử chế tài (lọc theo trạng thái, loại, đối tượng)' })
  list(@Query() query: ListSanctionsQueryDto): Promise<PaginatedResponse<SanctionDto>> {
    return this.listSanctions.execute(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'UC59/UC60/UC56 — Áp chế tài dựa trên báo cáo đã có căn cứ' })
  @ApiResponse({ status: 409, description: 'SANCTION_REPORT_NOT_SUBSTANTIATED | SANCTION_ESCALATION_REQUIRED | ...' })
  apply(@CurrentUser() admin: { id: string }, @Body() body: ApplySanctionDto): Promise<SanctionDetailDto> {
    return this.applySanction.execute(admin, body);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Chi tiết chế tài kèm lịch sử' })
  detail(@Param('id', new ParseUUIDPipe()) id: string): Promise<SanctionDetailDto> {
    return this.getSanction.execute(id);
  }

  @Post(':id/lift')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'UC57 — Gỡ chế tài đang hiệu lực' })
  lift(
    @CurrentUser() admin: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReasonDto,
  ): Promise<SanctionDetailDto> {
    return this.liftSanction.execute(admin, id, body.reason);
  }
}
