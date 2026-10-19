export const JOB_BRANCH_USAGE_CHECKER_TOKEN = Symbol(
  'JOB_BRANCH_USAGE_CHECKER_TOKEN',
);

/**
 * Port C-07: Kiểm tra ràng buộc chi nhánh đang được sử dụng trong tin tuyển dụng
 * Đảm bảo tính toàn vẹn: "không xóa chi nhánh đang gắn với tin"
 */
export interface IJobBranchUsageChecker {
  isBranchInUse(branchId: string): Promise<boolean>;
}
