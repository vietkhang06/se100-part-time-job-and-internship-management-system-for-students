import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Inject,
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
  StudentProfileResponseDto,
  UserRole,
  CvSnapshotDto,
} from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { UpdateStudentProfileDto } from '../../application/dto/update-student-profile.dto';
import { GetStudentProfileUseCase } from '../../application/use-cases/get-student-profile.use-case';
import { UpdateStudentProfileUseCase } from '../../application/use-cases/update-student-profile.use-case';
import { GetCvSnapshotUseCase } from '../../application/use-cases/get-cv-snapshot.use-case';
import {
  ICvRepository,
  CV_REPOSITORY_TOKEN,
} from '../../domain/repositories/cv.repository.interface';
import { InMemoryCvRepository } from '../../infrastructure/persistence/in-memory-cv.repository';

/**
 * StudentsController
 *
 * Quản lý hồ sơ sinh viên (UC11–UC12) và trích xuất Snapshot CV cho hồ sơ ứng tuyển (Contract C-03 / UC37–UC38).
 */
@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller('students')
export class StudentsController {
  constructor(
    private readonly getProfileUseCase: GetStudentProfileUseCase,
    private readonly updateProfileUseCase: UpdateStudentProfileUseCase,
    private readonly getCvSnapshotUseCase: GetCvSnapshotUseCase,
    @Inject(CV_REPOSITORY_TOKEN)
    private readonly cvRepo: ICvRepository,
  ) {}

  /**
   * UC11 – Xem hồ sơ cá nhân
   * GET /api/v1/students/profile
   */
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC11 – Lấy hồ sơ sinh viên đang đăng nhập' })
  @ApiResponse({ status: 200, description: 'Hồ sơ sinh viên' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không phải vai trò STUDENT' })
  async getProfile(
    @CurrentUser('id') userId: string,
  ): Promise<StudentProfileResponseDto> {
    return this.getProfileUseCase.execute(userId);
  }

  /**
   * UC12 – Cập nhật hồ sơ cá nhân
   * PATCH /api/v1/students/profile
   */
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC12 – Cập nhật hồ sơ sinh viên' })
  @ApiResponse({ status: 200, description: 'Hồ sơ đã cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không phải vai trò STUDENT' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateStudentProfileDto,
  ): Promise<StudentProfileResponseDto> {
    return this.updateProfileUseCase.execute(userId, dto);
  }

  /**
   * Contract C-03 / UC37–UC38 – Lấy bản chụp snapshot CV của sinh viên
   * GET /api/v1/students/cvs/:id/snapshot
   */
  @Get('cvs/:id/snapshot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Contract C-03 / UC37–UC38 – Lấy bản chụp snapshot CV bất biến phục vụ nộp hồ sơ',
  })
  @ApiParam({
    name: 'id',
    description:
      'ID của CV (Dùng "cv-sample-test" để test lấy CV của mình, hoặc "cv-alien-forbidden" để test chống IDOR)',
  })
  @ApiResponse({ status: 200, description: 'Bản chụp Snapshot CV bất biến' })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy CV hoặc không thuộc quyền sở hữu (Anti-IDOR)',
  })
  async getCvSnapshot(
    @CurrentUser('id') userId: string,
    @Param('id') cvId: string,
  ): Promise<CvSnapshotDto> {
    const profileRes = await this.getProfileUseCase.execute(userId);
    const profileId = profileRes.profile.id;

    // Hỗ trợ liên kết CV mẫu cho sinh viên đang kiểm thử trực tiếp
    if (
      cvId === 'cv-sample-test' &&
      this.cvRepo instanceof InMemoryCvRepository
    ) {
      this.cvRepo.ensureSampleForProfile(profileId);
    }

    return this.getCvSnapshotUseCase.execute(profileId, cvId);
  }
}

