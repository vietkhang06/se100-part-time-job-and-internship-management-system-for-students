import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  UserRole,
  CvListResponseDto,
  CvDetailResponseDto,
  CvResponseDto,
  SetDefaultCvResponseDto,
  DeleteCvResponseDto,
} from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { CreateCvDto } from '../../application/dto/create-cv.dto';
import { UpdateCvDto } from '../../application/dto/update-cv.dto';
import { ListCvsUseCase } from '../../application/use-cases/list-cvs.use-case';
import { GetCvDetailUseCase } from '../../application/use-cases/get-cv-detail.use-case';
import { CreateCvUseCase } from '../../application/use-cases/create-cv.use-case';
import { UpdateCvUseCase } from '../../application/use-cases/update-cv.use-case';
import { SetDefaultCvUseCase } from '../../application/use-cases/set-default-cv.use-case';
import { DeleteCvUseCase } from '../../application/use-cases/delete-cv.use-case';

/**
 * CvsController (M02 – CV Management UC31–UC35 / CV01–CV05)
 *
 * Kiểm soát quyền:
 *  - JwtAuthGuard: xác thực JWT Token
 *  - RolesGuard: yêu cầu vai trò STUDENT
 *  - Ownership: userId trích xuất từ JWT qua @CurrentUser('id'), ngăn chặn IDOR
 */
@ApiTags('Students - CV Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller('students/cvs')
export class CvsController {
  constructor(
    private readonly listCvsUseCase: ListCvsUseCase,
    private readonly getCvDetailUseCase: GetCvDetailUseCase,
    private readonly createCvUseCase: CreateCvUseCase,
    private readonly updateCvUseCase: UpdateCvUseCase,
    private readonly setDefaultCvUseCase: SetDefaultCvUseCase,
    private readonly deleteCvUseCase: DeleteCvUseCase,
  ) {}

  /**
   * UC31 / CV01 – Xem danh sách CV
   * GET /api/v1/students/cvs
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC31 – Lấy danh sách CV của sinh viên đang đăng nhập' })
  @ApiResponse({ status: 200, description: 'Danh sách CV của sinh viên' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không phải vai trò STUDENT' })
  async listCvs(@CurrentUser('id') userId: string): Promise<CvListResponseDto> {
    return this.listCvsUseCase.execute(userId);
  }

  /**
   * UC32 / CV02 – Xem chi tiết CV
   * GET /api/v1/students/cvs/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC32 – Xem chi tiết nội dung một CV' })
  @ApiResponse({ status: 200, description: 'Nội dung chi tiết CV' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không phải vai trò STUDENT' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy CV' })
  async getCvDetail(
    @CurrentUser('id') userId: string,
    @Param('id') cvId: string,
  ): Promise<CvDetailResponseDto> {
    return this.getCvDetailUseCase.execute(userId, cvId);
  }

  /**
   * UC33 / CV03 – Tạo CV mới
   * POST /api/v1/students/cvs
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'UC33 – Tạo CV mới cho sinh viên' })
  @ApiResponse({ status: 201, description: 'Tạo CV thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc vượt quá 10 CV' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không phải vai trò STUDENT' })
  async createCv(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCvDto,
  ): Promise<CvResponseDto> {
    return this.createCvUseCase.execute(userId, dto);
  }

  /**
   * UC34 / CV04 – Cập nhật CV
   * PATCH /api/v1/students/cvs/:id
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC34 – Cập nhật nội dung thông tin CV' })
  @ApiResponse({ status: 200, description: 'Cập nhật CV thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc hủy default trái phép' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không phải vai trò STUDENT' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy CV' })
  async updateCv(
    @CurrentUser('id') userId: string,
    @Param('id') cvId: string,
    @Body() dto: UpdateCvDto,
  ): Promise<CvResponseDto> {
    return this.updateCvUseCase.execute(userId, cvId, dto);
  }

  /**
   * UC34 / CV04 – Đặt làm CV mặc định
   * PATCH /api/v1/students/cvs/:id/default
   */
  @Patch(':id/default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC34 – Đặt nhanh một CV làm CV mặc định' })
  @ApiResponse({ status: 200, description: 'Đặt làm CV mặc định thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không phải vai trò STUDENT' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy CV' })
  async setDefaultCv(
    @CurrentUser('id') userId: string,
    @Param('id') cvId: string,
  ): Promise<SetDefaultCvResponseDto> {
    return this.setDefaultCvUseCase.execute(userId, cvId);
  }

  /**
   * UC35 / CV05 – Xóa CV
   * DELETE /api/v1/students/cvs/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC35 – Xóa CV thuộc sở hữu của sinh viên' })
  @ApiResponse({ status: 200, description: 'Xóa CV thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không phải vai trò STUDENT' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy CV' })
  @ApiResponse({ status: 409, description: 'CV đang dùng trong hồ sơ ứng tuyển' })
  async deleteCv(
    @CurrentUser('id') userId: string,
    @Param('id') cvId: string,
  ): Promise<DeleteCvResponseDto> {
    return this.deleteCvUseCase.execute(userId, cvId);
  }
}
