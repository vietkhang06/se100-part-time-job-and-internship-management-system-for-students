import {
  Controller,
  Get,
  Patch,
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
import { StudentProfileResponseDto, UserRole } from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { UpdateStudentProfileDto } from '../../application/dto/update-student-profile.dto';
import { GetStudentProfileUseCase } from '../../application/use-cases/get-student-profile.use-case';
import { UpdateStudentProfileUseCase } from '../../application/use-cases/update-student-profile.use-case';

/**
 * StudentsController
 *
 * Tại sao dùng hai guard:
 *  1. JwtAuthGuard  – xác thực token, gắn req.user từ JWT payload
 *  2. RolesGuard    – kiểm tra req.user.role === STUDENT
 *     → Nếu không phải STUDENT (403) hoặc chưa đăng nhập (401) đều bị từ chối.
 *
 * Ownership được đảm bảo bằng cách luôn lấy userId từ token (@CurrentUser('id'))
 * thay vì cho phép client truyền userId tùy ý qua body/params.
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
  ) {}

  /**
   * UC11 – Xem hồ sơ cá nhân
   * GET /api/v1/students/profile
   *
   * Nếu sinh viên chưa có hồ sơ → tự động tạo bản mặc định (createOrFind).
   * Trả về đúng dữ liệu của sinh viên đang đăng nhập.
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
   *
   * Chỉ cập nhật các trường được gửi lên (partial update).
   * Ownership: userId lấy từ JWT, không cho client tự chọn.
   * Validation: class-validator trên UpdateStudentProfileDto.
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
}
