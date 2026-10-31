import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  PublicJobPostingListResponseDto,
  PublicJobPostingResponseDto,
  SaveJobResponseDto,
  UserRole,
} from '@campusjob/contracts';
import { Public } from '../../../../shared/decorators/public.decorator';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { PublicJobQueryDto } from '../../application/dto/public-job-query.dto';
import { SearchPublicJobsUseCase } from '../../application/use-cases/search-public-jobs.use-case';
import { GetPublicJobDetailUseCase } from '../../application/use-cases/get-public-job-detail.use-case';
import { SaveJobUseCase } from '../../application/use-cases/save-job.use-case';
import { UnsaveJobUseCase } from '../../application/use-cases/unsave-job.use-case';

/**
 * PublicJobsController
 *
 * S5-M03-03 (C-07, C-08): Tra cứu và xem chi tiết tin tuyển dụng công khai (UC22, UC23).
 * S6-M03-01: Ghi nhận lượt xem công khai (deduped per viewer per calendar day, atomic increment).
 * S3-M03-03 / S5-M03-05: Lưu / bỏ lưu tin tuyển dụng (/jobs/:id/save).
 */
@ApiTags('Public Jobs')
@Controller(['jobs', 'public/jobs'])
export class PublicJobsController {
  constructor(
    private readonly searchJobsUseCase: SearchPublicJobsUseCase,
    private readonly getJobDetailUseCase: GetPublicJobDetailUseCase,
    private readonly saveJobUseCase: SaveJobUseCase,
    private readonly unsaveJobUseCase: UnsaveJobUseCase,
  ) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UC22 — Tìm kiếm tin tuyển dụng công khai',
    description:
      'Truy vấn công khai theo từ khóa, ngành nghề, địa điểm (thành phố), loại hình, mức lương và lịch làm việc.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách tin tuyển dụng công khai' })
  async search(
    @Query() query: PublicJobQueryDto,
  ): Promise<PublicJobPostingListResponseDto> {
    return this.searchJobsUseCase.execute(query);
  }

  @Get(':id')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UC23 — Chi tiết tin tuyển dụng công khai',
    description:
      'Chỉ hiển thị tin đủ điều kiện công khai (OPEN, chưa hết hạn, công ty VERIFIED). Tin không hợp lệ trả về 404.',
  })
  @ApiParam({ name: 'id', description: 'ID tin tuyển dụng' })
  @ApiResponse({ status: 200, description: 'Chi tiết tin tuyển dụng công khai' })
  @ApiResponse({ status: 404, description: 'Tin tuyển dụng không tồn tại hoặc chưa công khai' })
  async getDetail(
    @Param('id') id: string,
    @Req() req: Request = {} as Request,
  ): Promise<PublicJobPostingResponseDto> {
    // S6-M03-01: Xác định viewerKey (authenticated vs anonymous SHA-256 IP+UA hash + secret salt)
    let viewerUserId: string | undefined = (req as any).user?.id;

    if (!viewerUserId) {
      const authHeader = req.headers?.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          // Trích xuất payload JWT unverified cho public route
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(
              Buffer.from(parts[1], 'base64').toString('utf8'),
            );
            if (payload && payload.sub) {
              viewerUserId = payload.sub;
            }
          }
        } catch {
          // Bỏ qua lỗi token trên route công khai
        }
      }
    }

    let viewerKey: string;
    if (viewerUserId) {
      viewerKey = `user:${viewerUserId}`;
    } else {
      const forwarded = req.headers?.['x-forwarded-for'];
      const ip =
        (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
        req.ip ||
        req.socket?.remoteAddress ||
        '127.0.0.1';
      const ua = req.headers?.['user-agent'] || 'unknown';
      const salt = process.env.VIEW_HASH_SALT || '';
      if (process.env.NODE_ENV === 'production' && !salt) {
        throw new InternalServerErrorException(
          'VIEW_HASH_SALT environment variable is required in production',
        );
      }
      const hash = crypto
        .createHash('sha256')
        .update(`${salt}|${ip}|${ua}`)
        .digest('hex')
        .substring(0, 32);
      viewerKey = `anon:${hash}`;
    }

    return this.getJobDetailUseCase.execute(id, {
      userId: viewerUserId,
      viewerKey,
    });
  }

  @Post(':id/save')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UC28 — Lưu tin tuyển dụng (Student only, Idempotent)',
  })
  @ApiParam({ name: 'id', description: 'ID tin tuyển dụng cần lưu' })
  @ApiResponse({ status: 200, description: 'Đã lưu tin tuyển dụng' })
  @ApiResponse({ status: 404, description: 'Tin không tồn tại hoặc không đủ điều kiện công khai' })
  async saveJob(
    @Param('id') jobId: string,
    @CurrentUser('id') studentId: string,
  ): Promise<SaveJobResponseDto> {
    return this.saveJobUseCase.execute(studentId, jobId);
  }

  @Delete(':id/save')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UC29 — Bỏ lưu tin tuyển dụng (Student only, Idempotent)',
  })
  @ApiParam({ name: 'id', description: 'ID tin tuyển dụng cần bỏ lưu' })
  @ApiResponse({ status: 200, description: 'Đã bỏ lưu tin tuyển dụng' })
  async unsaveJob(
    @Param('id') jobId: string,
    @CurrentUser('id') studentId: string,
  ): Promise<SaveJobResponseDto> {
    return this.unsaveJobUseCase.execute(studentId, jobId);
  }
}
