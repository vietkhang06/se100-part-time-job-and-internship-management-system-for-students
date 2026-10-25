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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  StreamableFile,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

export const CV_FILE_UPLOAD_LIMITS = {
  fileSize: 10 * 1024 * 1024, // 10MB HTTP boundary limit
  files: 1,
};

export const cvFileFilter = (
  req: any,
  file: { originalname?: string; mimetype?: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file) {
    return callback(new BadRequestException('Không tìm thấy tệp tải lên.'), false);
  }
  const ext = (file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const isAllowedExt = ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.doc');
  const isAllowedMime = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/octet-stream',
  ].includes(mime);

  if (!isAllowedExt || !isAllowedMime) {
    return callback(
      new BadRequestException(
        'Định dạng tệp không được hỗ trợ. Hệ thống chỉ chấp nhận tệp PDF hoặc Word (DOC/DOCX).',
      ),
      false,
    );
  }
  return callback(null, true);
};
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
  FileAssetDto,
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
import { UploadCvFileUseCase } from '../../application/use-cases/upload-cv-file.use-case';
import { DownloadCvFileUseCase } from '../../application/use-cases/download-cv-file.use-case';

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
    private readonly uploadCvFileUseCase: UploadCvFileUseCase,
    private readonly downloadCvFileUseCase: DownloadCvFileUseCase,
  ) {}

  /**
   * UC33b – Tải lên tệp tài liệu CV (PDF/DOCX) để lấy fileAssetId
   * POST /api/v1/students/cvs/upload
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: CV_FILE_UPLOAD_LIMITS,
      fileFilter: cvFileFilter,
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tải lên tệp tài liệu CV (PDF/DOCX) để lấy fileAssetId' })
  @ApiResponse({ status: 201, description: 'Tải lên thành công, trả về metadata FileAsset' })
  @ApiResponse({ status: 400, description: 'Tệp không hợp lệ hoặc vượt quá 10MB' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không phải vai trò STUDENT' })
  async uploadCvFile(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: any,
  ): Promise<FileAssetDto> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp tài liệu để tải lên.');
    }
    return this.uploadCvFileUseCase.execute(userId, file);
  }

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
   * UC32b / UC64–UC66 – Tải xuống tệp tài liệu CV (PDF/DOCX)
   * GET /api/v1/students/cvs/:id/download
   */
  @Get(':id/download')
  @Roles(UserRole.STUDENT, UserRole.EMPLOYER, UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Tải xuống tệp tài liệu CV (PDF/DOCX) thuộc sở hữu hoặc liên quan ứng tuyển' })
  @ApiResponse({ status: 200, description: 'Trả về luồng nhị phân của tệp tài liệu' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền sở hữu hoặc không có hồ sơ ứng tuyển liên quan' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy CV hoặc CV không có tệp đính kèm' })
  async downloadCvFile(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') cvId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const fileResult = await this.downloadCvFileUseCase.execute(userId, cvId, userRole);

    res.set({
      'Content-Type': fileResult.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileResult.fileName)}"`,
      'Content-Length': fileResult.sizeBytes.toString(),
    });

    return new StreamableFile(fileResult.buffer);
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
