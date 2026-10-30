export const JOB_BRANCH_USAGE_CHECKER_TOKEN = Symbol(
  'JOB_BRANCH_USAGE_CHECKER_TOKEN',
);

/**
 * Port C-07: Kiểm tra ràng buộc chi nhánh đang được sử dụng trong tin tuyển dụng
 * Đảm bảo tính toàn vẹn: "không xóa chi nhánh đang gắn với tin"
 * và "tin không thể tham chiếu chi nhánh không thuộc doanh nghiệp"
 */
export interface IJobBranchUsageChecker {
  isBranchInUse(branchId: string): Promise<boolean>;
  assertBranchBelongsToCompany(branchId: string, companyId: string): Promise<void>;
}
