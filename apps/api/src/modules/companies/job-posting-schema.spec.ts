import * as fs from 'fs';
import * as path from 'path';
import { JobStatus, JobType, JobPostingDto } from '@campusjob/contracts';

describe('S3-M03-05: JobPosting Schema, Contracts & Integrity', () => {
  const schemaPath = path.resolve(__dirname, '../../../prisma/schema.prisma');
  let schemaContent: string;

  beforeAll(() => {
    schemaContent = fs.readFileSync(schemaPath, 'utf8');
  });

  describe('Absence of Duplicate Models (Acceptance Criterion)', () => {
    it('should have model JobPosting and NOT have a competing model Job', () => {
      // Must define JobPosting
      expect(schemaContent).toMatch(/model\s+JobPosting\s+\{/);

      // Must NOT have "model Job {" which would cause duplicate definitions
      const jobModelMatches = schemaContent.match(/model\s+Job\s+\{/g);
      expect(jobModelMatches).toBeNull();
    });

    it('should define exactly one model SavedJob without duplicates', () => {
      const savedJobMatches = schemaContent.match(/model\s+SavedJob\s+\{/g);
      expect(savedJobMatches).not.toBeNull();
      expect(savedJobMatches?.length).toBe(1);
    });
  });

  describe('FR-08 Mandatory Field Coverage (Acceptance Criterion)', () => {
    it('should cover all required FR-08 fields on model JobPosting', () => {
      // 1. Tiêu đề (title)
      expect(schemaContent).toMatch(/title\s+String/);
      // 2. Mô tả (description)
      expect(schemaContent).toMatch(/description\s+String/);
      // 3. Ngành (industry)
      expect(schemaContent).toMatch(/industry\s+String/);
      // 4. Loại hình (type)
      expect(schemaContent).toMatch(/type\s+JobType/);
      // 5. Yêu cầu kỹ năng (skills)
      expect(schemaContent).toMatch(/skills\s+String\[\]/);
      // 6. Số lượng tuyển dụng (quantity)
      expect(schemaContent).toMatch(/quantity\s+Int/);
      // 7. Lương/trợ cấp (salary/allowance)
      expect(schemaContent).toMatch(/salary\s+String\?/);
      expect(schemaContent).toMatch(/salaryMin\s+Decimal\?/);
      expect(schemaContent).toMatch(/salaryMax\s+Decimal\?/);
      expect(schemaContent).toMatch(/isSalaryNegotiable\s+Boolean/);
      // 8. Lịch làm việc (schedule)
      expect(schemaContent).toMatch(/schedule\s+String\?/);
      // 9. Quyền lợi (benefits)
      expect(schemaContent).toMatch(/benefits\s+String\?/);
      // 10. Hạn nộp (deadline)
      expect(schemaContent).toMatch(/deadline\s+DateTime/);
      // 11. Trạng thái (status)
      expect(schemaContent).toMatch(/status\s+JobStatus/);
      // 12. Chi nhánh (branchId & relation)
      expect(schemaContent).toMatch(/branchId\s+String/);
      expect(schemaContent).toMatch(/branch\s+CompanyBranch\s+@relation/);
      // 13. Số lượt xem (view count)
      expect(schemaContent).toMatch(/viewCount\s+Int\s+@default\(0\)/);
    });
  });

  describe('Four Specified Job Statuses (Acceptance Criterion)', () => {
    it('should define the 4 specified non-conflicting job statuses in JobStatus enum', () => {
      expect(JobStatus.PENDING_APPROVAL).toBe('PENDING_APPROVAL'); // Chờ duyệt
      expect(JobStatus.OPEN).toBe('OPEN');                         // Đang tuyển
      expect(JobStatus.PAUSED).toBe('PAUSED');                     // Tạm dừng
      expect(JobStatus.CLOSED).toBe('CLOSED');                     // Đã đóng

      // Check schema contains all 4 enum values
      const enumMatch = schemaContent.match(/enum\s+JobStatus\s+\{([\s\S]*?)\}/);
      expect(enumMatch).not.toBeNull();
      const enumBody = enumMatch![1];
      expect(enumBody).toContain('PENDING_APPROVAL');
      expect(enumBody).toContain('OPEN');
      expect(enumBody).toContain('PAUSED');
      expect(enumBody).toContain('CLOSED');
    });

    it('should define JobType enum with expected values', () => {
      expect(JobType.PART_TIME).toBe('PART_TIME');
      expect(JobType.INTERNSHIP).toBe('INTERNSHIP');
      expect(JobType.FULL_TIME).toBe('FULL_TIME');
    });
  });

  describe('Branch & Company Relation Integrity', () => {
    it('should enforce onDelete: Restrict on CompanyBranch relation to prevent deleting branch in use', () => {
      expect(schemaContent).toMatch(
        /branch\s+CompanyBranch\s+@relation\(fields:\s*\[branchId,\s*companyId\],\s*references:\s*\[id,\s*companyId\],\s*onDelete:\s*Restrict\)/,
      );
    });

    it('should enforce onDelete: Cascade on Company relation', () => {
      expect(schemaContent).toMatch(
        /company\s+Company\s+@relation\(fields:\s*\[companyId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
      );
    });

    it('should enforce SavedJob unique constraint on [studentId, jobId]', () => {
      expect(schemaContent).toMatch(/@@unique\(\[studentId,\s*jobId\]\)/);
    });

    it('should enforce composite unique constraint on CompanyBranch(id, companyId) and composite FK on JobPosting', () => {
      // 1. CompanyBranch must define @@unique([id, companyId])
      const branchMatch = schemaContent.match(/model\s+CompanyBranch\s+\{([\s\S]*?)\}/);
      expect(branchMatch).not.toBeNull();
      expect(branchMatch![1]).toContain('@@unique([id, companyId])');

      // 2. JobPosting must reference CompanyBranch via (branchId, companyId) -> (id, companyId)
      const jobPostingMatch = schemaContent.match(/model\s+JobPosting\s+\{([\s\S]*?)\}/);
      expect(jobPostingMatch).not.toBeNull();
      expect(jobPostingMatch![1]).toMatch(
        /@relation\(fields:\s*\[branchId,\s*companyId\],\s*references:\s*\[id,\s*companyId\],\s*onDelete:\s*Restrict\)/,
      );
    });

    it('should prove at DB/schema level that a JobPosting cannot reference a branch belonging to another company (F1)', () => {
      // Because the foreign key constraint requires both branchId AND companyId to match a single record
      // in CompanyBranch(id, companyId), a JobPosting with companyId "X" and branchId "Y" (where branch Y
      // belongs to company "Z") will fail the DB foreign key constraint:
      // (branchId, companyId) -> ("Y", "X") does not exist in CompanyBranch where CompanyBranch("Y", "Z").
      const jobPostingMatch = schemaContent.match(/model\s+JobPosting\s+\{([\s\S]*?)\}/);
      expect(jobPostingMatch).not.toBeNull();
      expect(jobPostingMatch![1]).toMatch(
        /@relation\(fields:\s*\[branchId,\s*companyId\],\s*references:\s*\[id,\s*companyId\],/,
      );
    });
  });
});
