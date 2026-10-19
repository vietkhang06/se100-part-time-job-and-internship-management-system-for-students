import { Injectable } from '@nestjs/common';

export interface ReviewableApplication {
  applicationId: string;
  jobId: string;
  /** Trạng thái hồ sơ ứng tuyển (ApplicationStatus của M04), dạng chuỗi. */
  status: string;
}

/** M04 cài đặt: trả hồ sơ ứng tuyển CỦA CHÍNH sinh viên, hoặc null nếu không có/không thuộc về họ. */
export interface IApplicationReviewSource {
  getOwnedApplication(studentId: string, applicationId: string): Promise<ReviewableApplication | null>;
}

export interface ReviewCompanyInfo {
  companyId: string;
  companyName: string;
  /** User (nhà tuyển dụng) sở hữu doanh nghiệp. */
  ownerUserId: string;
}

/** M03 cài đặt: ánh xạ tin tuyển dụng/nhà tuyển dụng sang doanh nghiệp. */
export interface ICompanyDirectory {
  findByJob(jobId: string): Promise<ReviewCompanyInfo | null>;
  findByEmployer(employerUserId: string): Promise<ReviewCompanyInfo | null>;
}

/**
 * Nơi M03/M04 đăng ký adapter (thường trong onModuleInit). M05 không đọc bảng của các module đó.
 * Chưa đăng ký → các thao tác cần dữ liệu đó trả 503 (fail-closed), không đoán.
 */
@Injectable()
export class ReviewSourcesRegistry {
  private applicationSource?: IApplicationReviewSource;
  private companyDirectory?: ICompanyDirectory;

  registerApplicationSource(source: IApplicationReviewSource): void {
    this.applicationSource = source;
  }

  registerCompanyDirectory(directory: ICompanyDirectory): void {
    this.companyDirectory = directory;
  }

  getApplicationSource(): IApplicationReviewSource | undefined {
    return this.applicationSource;
  }

  getCompanyDirectory(): ICompanyDirectory | undefined {
    return this.companyDirectory;
  }
}
