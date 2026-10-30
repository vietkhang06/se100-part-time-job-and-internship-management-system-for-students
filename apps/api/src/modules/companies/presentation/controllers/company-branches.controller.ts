import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
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
  CompanyBranchResponseDto,
  CompanyBranchListResponseDto,
  DeleteCompanyBranchResponseDto,
} from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { CreateCompanyBranchDto } from '../../application/dto/create-company-branch.dto';
import { UpdateCompanyBranchDto } from '../../application/dto/update-company-branch.dto';
import { CreateBranchUseCase } from '../../application/use-cases/create-branch.use-case';
import { ListBranchesUseCase } from '../../application/use-cases/list-branches.use-case';
import { GetBranchDetailUseCase } from '../../application/use-cases/get-branch-detail.use-case';
import { UpdateBranchUseCase } from '../../application/use-cases/update-branch.use-case';
import { DeleteBranchUseCase } from '../../application/use-cases/delete-branch.use-case';

/**
 * CompanyBranchesController
 *
 * S4-M03-03: Quản lý chi nhánh & tọa độ địa lý của doanh nghiệp (C-06, C-07).
 */
@ApiTags('Company Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER)
@Controller('companies/branches')
export class CompanyBranchesController {
  constructor(
    private readonly createBranchUseCase: CreateBranchUseCase,
    private readonly listBranchesUseCase: ListBranchesUseCase,
    private readonly getBranchDetailUseCase: GetBranchDetailUseCase,
    private readonly updateBranchUseCase: UpdateBranchUseCase,
    private readonly deleteBranchUseCase: DeleteBranchUseCase,
  ) {}

  /**
   * S4-M03-03: Tạo chi nhánh mới cho doanh nghiệp hiện tại
   * POST /api/v1/companies/branches
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Thêm chi nhánh mới cho doanh nghiệp hiện tại (hỗ trợ tọa độ)' })
  @ApiResponse({ status: 201, description: 'Chi nhánh đã được tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc tọa độ ngoài phạm vi' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền tạo chi nhánh' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCompanyBranchDto,
  ): Promise<CompanyBranchResponseDto> {
    return this.createBranchUseCase.execute(userId, dto);
  }

  /**
   * S4-M03-03: Danh sách chi nhánh của doanh nghiệp hiện tại
   * GET /api/v1/companies/branches
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách các chi nhánh của doanh nghiệp hiện tại' })
  @ApiResponse({ status: 200, description: 'Danh sách chi nhánh' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async list(
    @CurrentUser('id') userId: string,
  ): Promise<CompanyBranchListResponseDto> {
    return this.listBranchesUseCase.execute(userId);
  }

  /**
   * GET /api/v1/companies/branches/:id — Chi tiết chi nhánh theo ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xem chi tiết một chi nhánh (bảo vệ tenant isolation)' })
  @ApiParam({ name: 'id', description: 'ID chi nhánh' })
  @ApiResponse({ status: 200, description: 'Thông tin chi nhánh' })
  @ApiResponse({ status: 403, description: 'Không thuộc quyền sở hữu doanh nghiệp' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chi nhánh' })
  async getDetail(
    @CurrentUser('id') userId: string,
    @Param('id') branchId: string,
  ): Promise<CompanyBranchResponseDto> {
    return this.getBranchDetailUseCase.execute(userId, branchId);
  }

  /**
   * PATCH /api/v1/companies/branches/:id — Cập nhật thông tin chi nhánh
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật thông tin chi nhánh' })
  @ApiParam({ name: 'id', description: 'ID chi nhánh' })
  @ApiResponse({ status: 200, description: 'Cập nhật chi nhánh thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc tọa độ ngoài phạm vi' })
  @ApiResponse({ status: 403, description: 'Không có quyền chỉnh sửa chi nhánh này' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chi nhánh' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') branchId: string,
    @Body() dto: UpdateCompanyBranchDto,
  ): Promise<CompanyBranchResponseDto> {
    return this.updateBranchUseCase.execute(userId, branchId, dto);
  }

  /**
   * DELETE /api/v1/companies/branches/:id — Xóa chi nhánh
   * Ràng buộc: Không cho xóa chi nhánh đang được tin tuyển dụng tham chiếu
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xóa chi nhánh (từ chối xóa nếu đang được tin tuyển dụng tham chiếu)',
  })
  @ApiParam({ name: 'id', description: 'ID chi nhánh' })
  @ApiResponse({ status: 200, description: 'Xóa chi nhánh thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa chi nhánh này' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chi nhánh' })
  @ApiResponse({
    status: 409,
    description: 'Chi nhánh đang được gắn với tin tuyển dụng (Conflict)',
  })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id') branchId: string,
  ): Promise<DeleteCompanyBranchResponseDto> {
    return this.deleteBranchUseCase.execute(userId, branchId);
  }
}
