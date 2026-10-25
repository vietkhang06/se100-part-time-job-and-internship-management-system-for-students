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
  PublicCompanyListResponseDto,
  PublicCompanyResponseDto,
} from '@campusjob/contracts';
import { Public } from '../../../../shared/decorators/public.decorator';
import { PublicCompanyQueryDto } from '../../application/dto/public-company-query.dto';
import { SearchPublicCompaniesUseCase } from '../../application/use-cases/search-public-companies.use-case';
import { GetPublicCompanyDetailUseCase } from '../../application/use-cases/get-public-company-detail.use-case';

/**
 * PublicCompaniesController
 *
 * S5-M03-04 (C-06): Danh sách và chi tiết doanh nghiệp công khai (UC15, UC16).
 * - Hoàn toàn không yêu cầu đăng nhập (@Public())
 * - Chỉ trả về các doanh nghiệp có verificationStatus === VERIFIED
 * - Chi tiết bao gồm: hồ sơ doanh nghiệp (toPublicDto), chi nhánh (toPublicDto), tin đang tuyển (chỉ tin OPEN/unexpired)
 * - Tuyệt đối không để lộ mã số thuế (taxId), tài liệu pháp lý, email nội bộ quản trị
 * - reviewSummary để null (C-18 đang là DRAFT, chưa tích hợp chính thức)
 */
@ApiTags('Public Companies')
@Controller('public/companies')
export class PublicCompaniesController {
  constructor(
    private readonly searchCompaniesUseCase: SearchPublicCompaniesUseCase,
    private readonly getCompanyDetailUseCase: GetPublicCompanyDetailUseCase,
  ) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UC15 — Danh sách doanh nghiệp đã được xác thực công khai',
    description:
      'Chỉ hiển thị các doanh nghiệp có trạng thái VERIFIED. Hỗ trợ lọc theo từ khóa, ngành nghề và thành phố.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách doanh nghiệp công khai' })
  async search(
    @Query() query: PublicCompanyQueryDto,
  ): Promise<PublicCompanyListResponseDto> {
    return this.searchCompaniesUseCase.execute(query);
  }

  @Get(':id')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UC16 — Chi tiết doanh nghiệp công khai',
    description:
      'Hiển thị thông tin hồ sơ, danh sách chi nhánh và các tin tuyển dụng đang mở. Doanh nghiệp chưa xác thực trả về 404.',
  })
  @ApiParam({ name: 'id', description: 'ID doanh nghiệp' })
  @ApiResponse({ status: 200, description: 'Chi tiết doanh nghiệp công khai' })
  @ApiResponse({
    status: 404,
    description: 'Doanh nghiệp không tồn tại hoặc chưa được kích hoạt',
  })
  async getDetail(@Param('id') id: string): Promise<PublicCompanyResponseDto> {
    return this.getCompanyDetailUseCase.execute(id);
  }
}
