import {
  Controller,
  Get,
  Post,
  Delete,
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
  SaveJobResponseDto,
  SavedJobListResponseDto,
  SavedJobIdsResponseDto,
} from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { SaveJobUseCase } from '../../application/use-cases/save-job.use-case';
import { UnsaveJobUseCase } from '../../application/use-cases/unsave-job.use-case';
import { ListSavedJobsUseCase } from '../../application/use-cases/list-saved-jobs.use-case';
import { GetSavedJobIdsUseCase } from '../../application/use-cases/get-saved-job-ids.use-case';
import { SavedJobQueryDto } from '../../application/dto/saved-job-query.dto';

/**
 * SavedJobsController
 *
 * S3-M03-03 + S5-M03-05 (C-01, C-09): Quản lý tin tuyển dụng đã lưu của Sinh viên (UC28, UC29).
 * - Yêu cầu vai trò STUDENT (@Roles(UserRole.STUDENT)).
 * - studentId lấy hoàn toàn từ AuthContext (req.user.id), không nhận từ client.
 * - Lưu tin và bỏ lưu idempotent.
 * - Danh sách tin phân trang ổn định, bảo mật dữ liệu nhạy cảm cho các tin không còn khả dụng.
 */
@ApiTags('Student Saved Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller(['student/saved-jobs', 'saved-jobs'])
export class SavedJobsController {
  constructor(
    private readonly saveJobUseCase: SaveJobUseCase,
    private readonly unsaveJobUseCase: UnsaveJobUseCase,
    private readonly listSavedJobsUseCase: ListSavedJobsUseCase,
    private readonly getSavedJobIdsUseCase: GetSavedJobIdsUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UC28 — Xem danh sách tin tuyển dụng đã lưu của sinh viên',
  })
  @ApiResponse({ status: 200, description: 'Danh sách tin đã lưu' })
  async listSaved(
    @CurrentUser('id') studentId: string,
    @Query() query: SavedJobQueryDto,
  ): Promise<SavedJobListResponseDto> {
    return this.listSavedJobsUseCase.execute(studentId, query);
  }

  @Get('ids')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy danh sách ID các tin đã lưu của sinh viên',
  })
  @ApiResponse({ status: 200, description: 'Danh sách ID tin đã lưu' })
  async getSavedIds(
    @CurrentUser('id') studentId: string,
  ): Promise<SavedJobIdsResponseDto> {
    return this.getSavedJobIdsUseCase.execute(studentId);
  }

  @Post(':jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UC28 — Lưu tin tuyển dụng (Idempotent)',
  })
  @ApiParam({ name: 'jobId', description: 'ID tin tuyển dụng cần lưu' })
  @ApiResponse({ status: 200, description: 'Đã lưu tin tuyển dụng' })
  @ApiResponse({ status: 404, description: 'Tin không tồn tại hoặc không công khai' })
  async save(
    @CurrentUser('id') studentId: string,
    @Param('jobId') jobId: string,
  ): Promise<SaveJobResponseDto> {
    return this.saveJobUseCase.execute(studentId, jobId);
  }

  @Delete(':jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UC29 — Bỏ lưu tin tuyển dụng (Idempotent)',
  })
  @ApiParam({ name: 'jobId', description: 'ID tin tuyển dụng cần bỏ lưu' })
  @ApiResponse({ status: 200, description: 'Đã bỏ lưu tin tuyển dụng' })
  async unsave(
    @CurrentUser('id') studentId: string,
    @Param('jobId') jobId: string,
  ): Promise<SaveJobResponseDto> {
    return this.unsaveJobUseCase.execute(studentId, jobId);
  }
}
