import { Injectable } from '@nestjs/common';

export interface SanctionedCompanyInfo {
  ownerUserId: string;
  name: string;
}

/**
 * M03 cài đặt để đình chỉ/gỡ đình chỉ doanh nghiệp (UC56, UC57) trên dữ liệu của chính họ.
 * suspend/unsuspend phải idempotent theo sanctionId. M05 không ghi vào bảng doanh nghiệp.
 */
export interface ICompanySanctionHandler {
  describe(companyId: string): Promise<SanctionedCompanyInfo | null>;
  suspend(companyId: string, sanctionId: string, reason: string): Promise<void>;
  unsuspend(companyId: string, sanctionId: string): Promise<void>;
}

@Injectable()
export class CompanySanctionHandlerRegistry {
  private handler?: ICompanySanctionHandler;

  register(handler: ICompanySanctionHandler): void {
    this.handler = handler;
  }

  get(): ICompanySanctionHandler | undefined {
    return this.handler;
  }
}
