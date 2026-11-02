import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
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
  JobPostingDto,
  JobPostingResponseDto,
  JobPostingListResponseDto,
} from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { CreateJobPostingDto } from '../../application/dto/create-job-posting.dto';
import { UpdateJobPostingDto } from '../../application/dto/update-job-posting.dto';
import { JobPostingQueryDto } from '../../application/dto/job-posting-query.dto';
import { CreateJobPostingUseCase } from '../../application/use-cases/create-job-posting.use-case';
import { UpdateJobPostingUseCase } from '../../application/use-cases/update-job-posting.use-case';
import { ListEmployerJobsUseCase } from '../../application/use-cases/list-employer-jobs.use-case';
import { GetEmployerJobDetailUseCase } from '../../application/use-cases/get-employer-job-detail.use-case';
import { PauseJobPostingUseCase } from '../../application/use-cases/pause-job-posting.use-case';
import { ResumeJobPostingUseCase } from '../../application/use-cases/resume-job-posting.use-case';
import { CloseJobPostingUseCase } from '../../application/use-cases/close-job-posting.use-case';
import {
  SubmitJobPostingUseCase,
  SubmitJobPostingResponseDto,
} from '../../application/use-cases/submit-job-posting.use-case';

/**
 * JobsController
 *
 * S4-M03-04: API quản lý tin tuyển dụng phía Nhà tuyển dụng (Employer-owned Job Management).
 * S2-M03-04: Vòng đời tin (Tạo -> Chờ duyệt -> Tạm dừng / Mở lại -> Đóng).
 * S5-M03-01: Gửi duyệt tin qua cổng C-16.
 *
 * Không có route công khai trả về tin pending/rejected/closed/expired.
 */
@ApiTags('Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER)
@Controller('employer/jobs')
export class JobsController {
  constructor(
    private readonly createJobUseCase: CreateJobPostingUseCase,
    private readonly updateJobUseCase: UpdateJobPostingUseCase,
    private readonly listEmployerJobsUseCase: ListEmployerJobsUseCase,
    private readonly getEmployerJobDetailUseCase: GetEmployerJobDetailUseCase,
    private readonly pauseJobUseCase: PauseJobPostingUseCase,
    private readonly resumeJobUseCase: ResumeJobPostingUseCase,
    private readonly closeJobUseCase: CloseJobPostingUseCase,
    private readonly submitJobUseCase: SubmitJobPostingUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo tin tuyển dụng mới',
    description: 'Tin mới tạo luôn ở trạng thái PENDING_APPROVAL và không tự động công khai.',
  })
  @ApiResponse({ status: 201, description: 'Tạo tin tuyển dụng thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu FR-08 không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Chi nhánh không thuộc sở hữu doanh nghiệp' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateJobPostingDto,
  ): Promise<JobPostingResponseDto> {
    return this.createJobUseCase.execute(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Danh sách tin tuyển dụng của doanh nghiệp mình',
    description: 'Chỉ trả về các tin thuộc quyền sở hữu của doanh nghiệp đang đăng nhập.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách tin tuyển dụng của doanh nghiệp' })
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: JobPostingQueryDto,
  ): Promise<JobPostingListResponseDto> {
    return this.listEmployerJobsUseCase.execute(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chi tiết tin tuyển dụng của doanh nghiệp mình' })
  @ApiParam({ name: 'id', description: 'ID tin tuyển dụng' })
  @ApiResponse({ status: 200, description: 'Chi tiết tin tuyển dụng' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập tin của doanh nghiệp khác' })
  @ApiResponse({ status: 404, description: 'Tin tuyển dụng không tồn tại' })
  async getDetail(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<JobPostingResponseDto> {
    return this.getEmployerJobDetailUseCase.execute(userId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chỉnh sửa thông tin tin tuyển dụng' })
  @ApiParam({ name: 'id', description: 'ID tin tuyển dụng' })
  @ApiResponse({ status: 200, description: 'Cập nhật tin tuyển dụng thành công' })
  @ApiResponse({ status: 400, description: 'Tin đã đóng hoặc dữ liệu không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không có quyền sửa tin của doanh nghiệp khác' })
  @ApiResponse({ status: 404, description: 'Tin tuyển dụng không tồn tại' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateJobPostingDto,
  ): Promise<JobPostingResponseDto> {
    return this.updateJobUseCase.execute(userId, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi tin tuyển dụng sang kiểm duyệt (C-16)' })
  @ApiParam({ name: 'id', description: 'ID tin tuyển dụng' })
  @ApiResponse({ status: 200, description: 'Gửi kiểm duyệt thành công' })
  @ApiResponse({ status: 400, description: 'Tin đang công khai hoặc đã đóng' })
  @ApiResponse({ status: 503, description: 'Dịch vụ kiểm duyệt C-16 chưa khả dụng' })
  async submit(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<SubmitJobPostingResponseDto> {
    return this.submitJobUseCase.execute(userId, id);
  }

  @Patch(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạm dừng tin tuyển dụng (OPEN -> PAUSED)' })
  @ApiParam({ name: 'id', description: 'ID tin tuyển dụng' })
  @ApiResponse({ status: 200, description: 'Tạm dừng tin thành công' })
  @ApiResponse({ status: 400, description: 'Tin không ở trạng thái OPEN' })
  async pause(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<JobPostingResponseDto> {
    return this.pauseJobUseCase.execute(userId, id);
  }

  @Patch(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mở lại tin tuyển dụng (PAUSED -> OPEN)' })
  @ApiParam({ name: 'id', description: 'ID tin tuyển dụng' })
  @ApiResponse({ status: 200, description: 'Mở lại tin thành công' })
  @ApiResponse({ status: 400, description: 'Tin hết hạn hoặc doanh nghiệp chưa xác thực' })
  async resume(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<JobPostingResponseDto> {
    return this.resumeJobUseCase.execute(userId, id);
  }

  @Patch(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đóng tin tuyển dụng' })
  @ApiParam({ name: 'id', description: 'ID tin tuyển dụng' })
  @ApiResponse({ status: 200, description: 'Đóng tin thành công' })
  async close(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<JobPostingResponseDto> {
    return this.closeJobUseCase.execute(userId, id);
  }
}
