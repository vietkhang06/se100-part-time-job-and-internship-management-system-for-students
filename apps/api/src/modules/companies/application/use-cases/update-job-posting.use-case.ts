import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  CompanyErrorCode,
  JobErrorCode,
  JobPostingResponseDto,
  JobStatus,
} from '@campusjob/contracts';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';
import {
  ICompanyMemberRepository,
  COMPANY_MEMBER_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-member.repository.interface';
import {
  ICompanyBranchRepository,
  COMPANY_BRANCH_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-branch.repository.interface';
import { UpdateJobPostingDto } from '../dto/update-job-posting.dto';

@Injectable()
export class UpdateJobPostingUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
    @Inject(COMPANY_BRANCH_REPOSITORY_TOKEN)
    private readonly branchRepo: ICompanyBranchRepository,
  ) {}

  async execute(
    userId: string,
    jobId: string,
    dto: UpdateJobPostingDto,
  ): Promise<JobPostingResponseDto> {
    const membership = await this.memberRepo.findActiveByUserId(userId);
    if (!membership) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tài khoản chưa được liên kết với doanh nghiệp nào.',
        error: 'Not Found',
        code: CompanyErrorCode.EMPLOYER_HAS_NO_COMPANY,
      });
    }

    if (!membership.hasManagementPermission()) {
      throw new ForbiddenException({
        statusCode: 403,
        message:
          'Chỉ chủ sở hữu hoặc quản trị viên doanh nghiệp mới có quyền chỉnh sửa tin tuyển dụng.',
        error: 'Forbidden',
        code: CompanyErrorCode.FORBIDDEN,
      });
    }

    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy tin tuyển dụng.',
        error: 'Not Found',
        code: JobErrorCode.JOB_NOT_FOUND,
      });
    }

    // Kiểm tra quyền sở hữu đối với tin tuyển dụng (Tenant Isolation)
    if (job.companyId !== membership.companyId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không có quyền chỉnh sửa tin tuyển dụng của doanh nghiệp khác.',
        error: 'Forbidden',
        code: JobErrorCode.JOB_NOT_OWNED,
      });
    }

    if (job.status === JobStatus.CLOSED) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Tin tuyển dụng đã đóng không thể chỉnh sửa thông tin.',
        error: 'Bad Request',
        code: JobErrorCode.JOB_INVALID_STATE_TRANSITION,
      });
    }

    // Nếu đổi chi nhánh, kiểm tra chi nhánh mới có thuộc doanh nghiệp không
    if (dto.branchId && dto.branchId !== job.branchId) {
      const branch = await this.branchRepo.findById(dto.branchId);
      if (!branch || branch.companyId !== membership.companyId) {
        throw new ForbiddenException({
          statusCode: 403,
          message:
            'Chi nhánh được chọn không tồn tại hoặc không thuộc doanh nghiệp của bạn.',
          error: 'Forbidden',
          code: JobErrorCode.JOB_BRANCH_NOT_OWNED,
        });
      }
    }

    let parsedDeadline: Date | undefined;
    if (dto.deadline) {
      parsedDeadline = new Date(dto.deadline);
      if (isNaN(parsedDeadline.getTime())) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Hạn nộp hồ sơ không hợp lệ.',
          error: 'Bad Request',
          code: JobErrorCode.VALIDATION_ERROR,
        });
      }
      if (parsedDeadline.getTime() <= Date.now()) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Hạn nộp hồ sơ phải là một thời điểm trong tương lai.',
          error: 'Bad Request',
          code: JobErrorCode.VALIDATION_ERROR,
        });
      }
    }

    const newSalaryMin = dto.salaryMin !== undefined ? dto.salaryMin : job.salaryMin;
    const newSalaryMax = dto.salaryMax !== undefined ? dto.salaryMax : job.salaryMax;
    if (
      newSalaryMin !== null &&
      newSalaryMax !== null &&
      newSalaryMin !== undefined &&
      newSalaryMax !== undefined &&
      newSalaryMin > newSalaryMax
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Mức lương tối thiểu không được lớn hơn mức lương tối đa.',
        error: 'Bad Request',
        code: JobErrorCode.VALIDATION_ERROR,
      });
    }

    const updated = await this.jobRepo.update(jobId, {
      branchId: dto.branchId,
      title: dto.title?.trim(),
      description: dto.description?.trim(),
      industry: dto.industry?.trim(),
      type: dto.type,
      skills: dto.skills,
      quantity: dto.quantity,
      salary: dto.salary !== undefined ? dto.salary?.trim() ?? null : undefined,
      salaryMin: dto.salaryMin,
      salaryMax: dto.salaryMax,
      isSalaryNegotiable: dto.isSalaryNegotiable,
      schedule: dto.schedule !== undefined ? dto.schedule?.trim() ?? null : undefined,
      benefits: dto.benefits !== undefined ? dto.benefits?.trim() ?? null : undefined,
      deadline: parsedDeadline,
    });

    return { job: updated.toDto() };
  }
}
