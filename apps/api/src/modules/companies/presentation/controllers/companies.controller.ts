import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Inject,
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
} from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { CreateCompanyDto } from '../../application/dto/create-company.dto';
import { UpdateCompanyProfileDto } from '../../application/dto/update-company-profile.dto';
import { UpdateCompanyVerificationStatusDto } from '../../application/dto/update-verification-status.dto';
import { GetCompanyProfileUseCase } from '../../application/use-cases/get-company-profile.use-case';
import { UpdateCompanyProfileUseCase } from '../../application/use-cases/update-company-profile.use-case';
import { CreateCompanyUseCase } from '../../application/use-cases/create-company.use-case';
import { VerifyCompanyUseCase } from '../../application/use-cases/verify-company.use-case';
import {
  ICompanyRepository,
  COMPANY_REPOSITORY_TOKEN,
} from '../../domain/repositories/company.repository.interface';

/**
 * CompaniesController
 *
 * S2-M03-01: Quản lý hồ sơ doanh nghiệp và trạng thái xác thực.
 */
@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly getProfileUseCase: GetCompanyProfileUseCase,
    private readonly updateProfileUseCase: UpdateCompanyProfileUseCase,
    private readonly createCompanyUseCase: CreateCompanyUseCase,
    private readonly verifyCompanyUseCase: VerifyCompanyUseCase,
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
  ) {}

  /**
   * S2-M03-01 / UC17 – Lấy hồ sơ doanh nghiệp hiện tại của nhà tuyển dụng
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
   * S2-M03-01 / UC18 – Cập nhật hồ sơ doanh nghiệp hiện tại
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
   * POST /api/v1/companies — Khởi tạo doanh nghiệp mới cho nhà tuyển dụng
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
   * S2-M03-01 / UC19 – Cập nhật hồ sơ doanh nghiệp theo ID (Kiểm soát tenant nghiêm ngặt)
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
   * GET /api/v1/companies/:id — Xem chi tiết công ty theo ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.STUDENT, UserRole.EMPLOYER, UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Xem chi tiết doanh nghiệp theo ID' })
  @ApiParam({ name: 'id', description: 'ID công ty' })
  async getById(@Param('id') companyId: string): Promise<CompanyResponseDto> {
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
   * S2-M03-01 / UC56 – Duyệt/Từ chối xác thực doanh nghiệp (Chỉ MODERATOR hoặc ADMIN)
   * PATCH /api/v1/companies/:id/verification-status
   */
  @Patch(':id/verification-status')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Duyệt hoặc từ chối xác thực doanh nghiệp' })
  @ApiParam({ name: 'id', description: 'ID công ty' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái xác thực thành công' })
  @ApiResponse({ status: 400, description: 'Trạng thái chuyển đổi không hợp lệ hoặc thiếu lý do' })
  @ApiResponse({ status: 403, description: 'Không có quyền kiểm duyệt' })
  async updateVerificationStatus(
    @CurrentUser('id') reviewerId: string,
    @Param('id') companyId: string,
    @Body() dto: UpdateCompanyVerificationStatusDto,
  ): Promise<CompanyResponseDto> {
    return this.verifyCompanyUseCase.execute(reviewerId, companyId, dto);
  }
}
