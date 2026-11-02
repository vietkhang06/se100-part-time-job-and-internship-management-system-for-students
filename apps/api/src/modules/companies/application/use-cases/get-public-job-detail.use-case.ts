import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CompanyMemberStatus,
  JobErrorCode,
  PublicJobPostingResponseDto,
} from '@campusjob/contracts';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';
import {
  ICompanyMemberRepository,
  COMPANY_MEMBER_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-member.repository.interface';

export interface ViewerContext {
  userId?: string;
  isOwner?: boolean;
  viewerKey?: string;
}

@Injectable()
export class GetPublicJobDetailUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
  ) {}

  async execute(
    id: string,
    viewer?: ViewerContext,
  ): Promise<PublicJobPostingResponseDto> {
    const result = await this.jobRepo.findPublicById(id);

    if (!result) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tin tuyển dụng không tồn tại hoặc chưa công khai.',
        error: 'Not Found',
        code: JobErrorCode.JOB_NOT_FOUND,
      });
    }

    // S6-M03-01: Kiểm tra xem người xem có phải là chủ sở hữu tin không (Owner views never count)
    let isOwner = viewer?.isOwner ?? false;
    if (viewer?.userId && !isOwner) {
      const membership = await this.memberRepo.findByCompanyAndUser(
        result.job.companyId,
        viewer.userId,
      );
      if (membership && membership.status === CompanyMemberStatus.ACTIVE) {
        isOwner = true;
      }
    }

    // Ghi nhận view (bỏ qua nếu là chủ sở hữu tin, trùng trong ngày, hoặc tin không công khai)
    if (viewer?.viewerKey && !isOwner) {
      await this.jobRepo.recordPublicView(id, viewer.viewerKey);
    }

    return {
      job: result.job.toPublicDto({
        companyName: result.companyName,
        companyLogoUrl: result.companyLogoUrl,
        branchCity: result.branchCity,
        branchName: result.branchName,
      }),
    };
  }
}
