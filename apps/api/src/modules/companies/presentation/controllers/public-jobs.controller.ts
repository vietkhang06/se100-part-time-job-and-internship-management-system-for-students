import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import {
  PublicJobPostingListResponseDto,
  PublicJobPostingResponseDto,
} from '@campusjob/contracts';
import { Public } from '../../../../shared/decorators/public.decorator';
import { PublicJobQueryDto } from '../../application/dto/public-job-query.dto';
import { SearchPublicJobsUseCase } from '../../application/use-cases/search-public-jobs.use-case';
import { GetPublicJobDetailUseCase } from '../../application/use-cases/get-public-job-detail.use-case';

/**
 * PublicJobsController
 *
 * S5-M03-03 (C-07, C-08): Tra cứu và xem chi tiết tin tuyển dụng công khai (UC22, UC23).
 * - Hoàn toàn không yêu cầu đăng nhập (@Public())
 * - Bộ lọc: từ khóa, ngành nghề, địa điểm, loại hình, mức lương, lịch làm việc
 * - Phân trang ổn định (createdAt desc, id desc), giới hạn tối đa 50 tin/trang
 * - Shared Visibility Predicate: chỉ hiển thị tin OPEN, hạn nộp > now, công ty VERIFIED
 * - Tuyệt đối không để lộ dữ liệu nhạy cảm (rejectionReason, rejectedAt, hiddenByModeration)
 * - Không tự động tăng viewCount (dành cho session metrics riêng)
 */
@ApiTags('Public Jobs')
@Controller(['jobs', 'public/jobs'])
export class PublicJobsController {
  constructor(
    private readonly searchJobsUseCase: SearchPublicJobsUseCase,
    private readonly getJobDetailUseCase: GetPublicJobDetailUseCase,
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
  ): Promise<PublicJobPostingResponseDto> {
    return this.getJobDetailUseCase.execute(id);
  }
}
