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
  NotFoundException,
  Inject,
  Optional,
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
  CompanyProfileResponseDto,
  CompanyResponseDto,
  CompanyErrorCode,
  PublicCompanyListResponseDto,
  PublicCompanyResponseDto,
} from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { Public } from '../../../../shared/decorators/public.decorator';
import { CreateCompanyDto } from '../../application/dto/create-company.dto';
import { UpdateCompanyProfileDto } from '../../application/dto/update-company-profile.dto';
import { UpdateCompanyVerificationStatusDto } from '../../application/dto/update-verification-status.dto';
import { ResubmitVerificationDto } from '../../application/dto/resubmit-verification.dto';
import { PublicCompanyQueryDto } from '../../application/dto/public-company-query.dto';
import { GetCompanyProfileUseCase } from '../../application/use-cases/get-company-profile.use-case';
import { UpdateCompanyProfileUseCase } from '../../application/use-cases/update-company-profile.use-case';
import { CreateCompanyUseCase } from '../../application/use-cases/create-company.use-case';
import { VerifyCompanyUseCase } from '../../application/use-cases/verify-company.use-case';
import { ResubmitCompanyVerificationUseCase } from '../../application/use-cases/resubmit-company-verification.use-case';
import { GetCompanyVerificationHistoryUseCase } from '../../application/use-cases/get-company-verification-history.use-case';
import { SearchPublicCompaniesUseCase } from '../../application/use-cases/search-public-companies.use-case';
import { GetPublicCompanyDetailUseCase } from '../../application/use-cases/get-public-company-detail.use-case';
import {
  ICompanyRepository,
  COMPANY_REPOSITORY_TOKEN,
} from '../../domain/repositories/company.repository.interface';

/**
 * CompaniesController
 *
 * S4-M03-01: Quản lý hồ sơ doanh nghiệp và kiểm tra quyền CompanyMember/owner.
 * S4-M03-02: Quy trình xác thực doanh nghiệp (Admin-only decision, resubmit preserving history).
 * S5-M03-04: Danh sách và chi tiết doanh nghiệp công khai (UC15, UC16).
 */
@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['companies', 'public/companies'])
export class CompaniesController {
  constructor(
    private readonly getProfileUseCase: GetCompanyProfileUseCase,
    private readonly updateProfileUseCase: UpdateCompanyProfileUseCase,
    private readonly createCompanyUseCase: CreateCompanyUseCase,
    private readonly verifyCompanyUseCase: VerifyCompanyUseCase,
    private readonly resubmitVerificationUseCase: ResubmitCompanyVerificationUseCase,
    private readonly getVerificationHistoryUseCase: GetCompanyVerificationHistoryUseCase,
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
    @Optional()
    private readonly searchPublicCompaniesUseCase?: SearchPublicCompaniesUseCase,
    @Optional()
    private readonly getPublicCompanyDetailUseCase?: GetPublicCompanyDetailUseCase,
  ) {}

  /**
   * S5-M03-04: Danh sách doanh nghiệp đã được phê duyệt công khai (UC15)
   * GET /api/v1/companies
   */
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UC15 — Danh sách doanh nghiệp đã được xác thực công khai',
    description:
      'Chỉ hiển thị các doanh nghiệp đã được Admin duyệt (VERIFIED). Không lộ mã số thuế hoặc thông tin nội bộ.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách doanh nghiệp công khai' })
  async listPublic(
    @Query() query: PublicCompanyQueryDto,
  ): Promise<PublicCompanyListResponseDto> {
    if (this.searchPublicCompaniesUseCase) {
      return this.searchPublicCompaniesUseCase.execute(query);
    }
    const { companies, total } = await this.companyRepo.searchPublic(query);
    return {
      companies: companies.map((c) => c.toPublicDto()),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      totalPages: Math.max(1, Math.ceil(total / (query.limit ?? 10))),
    };
  }

  /**
   * S4-M03-01: Lấy hồ sơ doanh nghiệp của nhà tuyển dụng đang đăng nhập
   * GET /api/v1/companies/profile
   */
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Lấy hồ sơ doanh nghiệp của nhà tuyển dụng đang đăng nhập' })
  @ApiResponse({ status: 200, description: 'Hồ sơ doanh nghiệp' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không phải vai trò EMPLOYER' })
  @ApiResponse({ status: 404, description: 'Chưa liên kết doanh nghiệp' })
  async getProfile(
    @CurrentUser('id') userId: string,
  ): Promise<CompanyProfileResponseDto> {
    return this.getProfileUseCase.execute(userId);
  }

  /**
   * GET /api/v1/companies/me — bí danh cho /companies/profile
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Bí danh lấy hồ sơ doanh nghiệp hiện tại' })
  async getMe(
    @CurrentUser('id') userId: string,
  ): Promise<CompanyProfileResponseDto> {
    return this.getProfileUseCase.execute(userId);
  }

  /**
   * S4-M03-01: Cập nhật hồ sơ doanh nghiệp hiện tại
   * PATCH /api/v1/companies/profile
   */
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Cập nhật hồ sơ doanh nghiệp hiện tại' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền cập nhật' })
  @ApiResponse({ status: 404, description: 'Chưa liên kết doanh nghiệp' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCompanyProfileDto,
  ): Promise<CompanyProfileResponseDto> {
    return this.updateProfileUseCase.execute(userId, undefined, dto);
  }

  /**
   * PATCH /api/v1/companies/me — bí danh cho /companies/profile
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Bí danh cập nhật hồ sơ doanh nghiệp hiện tại' })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCompanyProfileDto,
  ): Promise<CompanyProfileResponseDto> {
    return this.updateProfileUseCase.execute(userId, undefined, dto);
  }

  /**
   * S4-M03-01: Khởi tạo doanh nghiệp mới cho nhà tuyển dụng
   * POST /api/v1/companies
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Khởi tạo hồ sơ doanh nghiệp mới' })
  @ApiResponse({ status: 201, description: 'Doanh nghiệp khởi tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không phải vai trò EMPLOYER' })
  @ApiResponse({ status: 409, description: 'Đã có doanh nghiệp hoặc MST đã tồn tại' })
  async createCompany(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCompanyDto,
  ): Promise<CompanyProfileResponseDto> {
    return this.createCompanyUseCase.execute(userId, dto);
  }

  /**
   * S4-M03-02: Gửi lại yêu cầu xác thực sau khi chỉnh sửa
   * POST /api/v1/companies/resubmit-verification
   */
  @Post('resubmit-verification')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Gửi lại yêu cầu xác thực doanh nghiệp (bảo toàn lịch sử cũ)' })
  @ApiResponse({ status: 200, description: 'Nộp lại yêu cầu xác thực thành công' })
  async resubmitVerification(
    @CurrentUser('id') userId: string,
    @Body() dto: ResubmitVerificationDto,
  ): Promise<CompanyProfileResponseDto> {
    return this.resubmitVerificationUseCase.execute(userId, dto);
  }

  /**
   * S4-M03-02: Xem lịch sử xác thực doanh nghiệp
   * GET /api/v1/companies/verification-history
   */
  @Get('verification-history')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Xem lịch sử các lần xác thực doanh nghiệp' })
  async getVerificationHistory(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.getVerificationHistoryUseCase.execute(
      userId,
      role === UserRole.ADMIN,
    );
  }

  /**
   * S4-M03-01: Cập nhật hồ sơ doanh nghiệp theo ID (Kiểm soát tenant nghiêm ngặt)
   * PATCH /api/v1/companies/:id
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Cập nhật hồ sơ doanh nghiệp theo ID (có kiểm tra sở hữu tenant)' })
  @ApiParam({ name: 'id', description: 'ID của công ty' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 403, description: 'Cố ý sửa doanh nghiệp khác (Cross-company rejected)' })
  async updateById(
    @CurrentUser('id') userId: string,
    @Param('id') companyId: string,
    @Body() dto: UpdateCompanyProfileDto,
  ): Promise<CompanyProfileResponseDto> {
    return this.updateProfileUseCase.execute(userId, companyId, dto);
  }

  /**
   * S5-M03-04: Xem chi tiết doanh nghiệp công khai (UC16)
   * GET /api/v1/companies/:id
   * - Public: Trả thông tin công khai (hồ sơ, chi nhánh, tin đang tuyển) nếu công ty đã VERIFIED
   * - Internal (EMPLOYER, ADMIN, MODERATOR): Cho phép xem cả công ty chưa xác thực
   */
  @Get(':id')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xem chi tiết doanh nghiệp theo ID' })
  @ApiParam({ name: 'id', description: 'ID công ty' })
  @ApiResponse({ status: 200, description: 'Lấy thông tin doanh nghiệp thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy doanh nghiệp hoặc chưa kích hoạt' })
  async getById(
    @Param('id') companyId: string,
    @CurrentUser('role') role?: UserRole,
  ): Promise<PublicCompanyResponseDto | CompanyResponseDto> {
    if (this.getPublicCompanyDetailUseCase) {
      try {
        return await this.getPublicCompanyDetailUseCase.execute(companyId);
      } catch (err: any) {
        if (
          role === UserRole.ADMIN ||
          role === UserRole.MODERATOR ||
          role === UserRole.EMPLOYER
        ) {
          const company = await this.companyRepo.findById(companyId);
          if (company) {
            return {
              message: 'Lấy thông tin doanh nghiệp thành công.',
              company: company.toDto(),
            };
          }
        }
        throw err;
      }
    }

    const company = await this.companyRepo.findById(companyId);
    if (!company) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy doanh nghiệp.',
        error: 'Not Found',
        code: CompanyErrorCode.COMPANY_NOT_FOUND,
      });
    }

    return {
      message: 'Lấy thông tin doanh nghiệp thành công.',
      company: company.toDto(),
    };
  }

  /**
   * S4-M03-02: Quyết định xác thực doanh nghiệp (CHỈ ADMIN ra quyết định)
   * PATCH /api/v1/companies/:id/verification-status
   */
  @Patch([':id/verification', ':id/verification-status'])
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Chỉ Admin duyệt hoặc từ chối xác thực doanh nghiệp' })
  @ApiParam({ name: 'id', description: 'ID công ty' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái xác thực thành công' })
  @ApiResponse({ status: 400, description: 'Hồ sơ thiếu giấy tờ hoặc từ chối thiếu lý do' })
  @ApiResponse({ status: 403, description: 'Không phải vai trò ADMIN' })
  async updateVerificationStatus(
    @CurrentUser('id') adminUserId: string,
    @Param('id') companyId: string,
    @Body() dto: UpdateCompanyVerificationStatusDto,
  ): Promise<CompanyResponseDto> {
    return this.verifyCompanyUseCase.execute(adminUserId, companyId, dto);
  }
}
