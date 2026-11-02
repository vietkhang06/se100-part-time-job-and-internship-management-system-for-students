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
import { CreateJobPostingDto } from '../dto/create-job-posting.dto';

@Injectable()
export class CreateJobPostingUseCase {
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
    dto: CreateJobPostingDto,
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
          'Chỉ chủ sở hữu hoặc quản trị viên doanh nghiệp mới có quyền tạo tin tuyển dụng.',
        error: 'Forbidden',
        code: CompanyErrorCode.FORBIDDEN,
      });
    }

    // Kiểm tra chi nhánh có thuộc doanh nghiệp này hay không
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

    const deadline = new Date(dto.deadline);
    if (isNaN(deadline.getTime())) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Hạn nộp hồ sơ không hợp lệ.',
        error: 'Bad Request',
        code: JobErrorCode.VALIDATION_ERROR,
      });
    }

    if (deadline.getTime() <= Date.now()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Hạn nộp hồ sơ phải là một thời điểm trong tương lai.',
        error: 'Bad Request',
        code: JobErrorCode.VALIDATION_ERROR,
      });
    }

    if (
      dto.salaryMin !== undefined &&
      dto.salaryMin !== null &&
      dto.salaryMax !== undefined &&
      dto.salaryMax !== null &&
      dto.salaryMin > dto.salaryMax
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Mức lương tối thiểu không được lớn hơn mức lương tối đa.',
        error: 'Bad Request',
        code: JobErrorCode.VALIDATION_ERROR,
      });
    }

    const job = await this.jobRepo.create({
      companyId: membership.companyId,
      branchId: dto.branchId,
      title: dto.title.trim(),
      description: dto.description.trim(),
      industry: dto.industry.trim(),
      type: dto.type,
      skills: dto.skills,
      quantity: dto.quantity,
      salary: dto.salary?.trim() ?? null,
      salaryMin: dto.salaryMin ?? null,
      salaryMax: dto.salaryMax ?? null,
      isSalaryNegotiable: dto.isSalaryNegotiable ?? false,
      schedule: dto.schedule?.trim() ?? null,
      benefits: dto.benefits?.trim() ?? null,
      deadline,
      status: JobStatus.PENDING_APPROVAL, // Tin mới tạo luôn ở trạng thái Chờ duyệt
    });

    return { job: job.toDto() };
  }
}
