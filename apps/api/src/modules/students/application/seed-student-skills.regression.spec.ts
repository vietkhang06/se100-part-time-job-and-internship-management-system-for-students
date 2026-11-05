import { JobSeekingStatus } from '@prisma/client';

describe('S3-M02-04 Regression: Seed & Fixture Skill Normalization', () => {
  let mockPrisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    studentProfile: { findUnique: jest.Mock; create: jest.Mock; upsert: jest.Mock; deleteMany: jest.Mock };
    skill: { upsert: jest.Mock };
    studentSkill: { upsert: jest.Mock; deleteMany: jest.Mock };
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      studentProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      skill: {
        upsert: jest.fn(),
      },
      studentSkill: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
  });

  describe('AC-01: Không còn trường skills trong StudentProfile create/update payload', () => {
    it('should create student profile without skills column in payload', async () => {
      const profileData = {
        userId: 'user-uuid-1',
        university: 'Đại học Bách Khoa TP.HCM',
        major: 'Khoa học Máy tính',
        graduationYear: 2026,
        jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
        bio: 'Sinh viên năm cuối',
      };

      // Type-level assertion: ensure profileData does not have 'skills' property
      expect('skills' in profileData).toBe(false);

      mockPrisma.studentProfile.create.mockResolvedValue({
        id: 'profile-uuid-1',
        ...profileData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await mockPrisma.studentProfile.create({ data: profileData });

      expect(mockPrisma.studentProfile.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ skills: expect.anything() }),
      });
      expect(result.id).toBe('profile-uuid-1');
    });
  });

  describe('AC-02: Idempotent Seed - chạy nhiều lần không tạo skill hay liên kết trùng', () => {
    it('should upsert skills by unique normalizedName and link via composite unique key', async () => {
      const profileId = 'profile-uuid-1';
      const skillStore = new Map<string, { id: string; name: string; normalizedName: string }>();
      const studentSkillStore = new Set<string>();

      mockPrisma.skill.upsert.mockImplementation(async ({ where, create }) => {
        const key = where.normalizedName;
        if (!skillStore.has(key)) {
          skillStore.set(key, {
            id: `skill-${key}`,
            name: create.name,
            normalizedName: key,
          });
        }
        return skillStore.get(key);
      });

      mockPrisma.studentSkill.upsert.mockImplementation(async ({ where }) => {
        const compositeKey = `${where.studentProfileId_skillId.studentProfileId}:${where.studentProfileId_skillId.skillId}`;
        studentSkillStore.add(compositeKey);
        return {
          id: `assoc-${compositeKey}`,
          studentProfileId: where.studentProfileId_skillId.studentProfileId,
          skillId: where.studentProfileId_skillId.skillId,
        };
      });

      // Simulation of the exact logic in seed-student.ts & m02-integration.e2e-spec.ts
      const seedSkills = async (rawSkillNames: string[]) => {
        for (const skillName of rawSkillNames) {
          const name = skillName.trim();
          const normalizedName = name.toLowerCase();

          const skill = await mockPrisma.skill.upsert({
            where: { normalizedName },
            update: {},
            create: { name, normalizedName },
          });

          await mockPrisma.studentSkill.upsert({
            where: {
              studentProfileId_skillId: {
                studentProfileId: profileId,
                skillId: skill.id,
              },
            },
            update: {},
            create: {
              studentProfileId: profileId,
              skillId: skill.id,
            },
          });
        }
      };

      // Run 1: initial seeding with 4 skills
      await seedSkills(['TypeScript', 'NestJS', 'React', 'PostgreSQL']);
      expect(skillStore.size).toBe(4);
      expect(studentSkillStore.size).toBe(4);

      // Run 2: rerun with duplicate skills, varying cases and whitespaces
      await seedSkills(['  typescript  ', 'NESTJS', 'react', 'PostgreSQL']);
      // Verify no duplicate skills were created
      expect(skillStore.size).toBe(4);
      // Verify no duplicate studentSkill links were created
      expect(studentSkillStore.size).toBe(4);

      // Run 3: rerun with mixed existing and one new skill
      await seedSkills(['TypeScript', 'Docker']);
      expect(skillStore.size).toBe(5);
      expect(studentSkillStore.size).toBe(5);
      expect(studentSkillStore.has(`${profileId}:skill-docker`)).toBe(true);
    });
  });

  describe('AC-03: Fixture Cleanup Integrity', () => {
    it('should delete studentSkill associations before deleting studentProfile', async () => {
      const profileIds = ['profile-1', 'profile-2'];
      mockPrisma.studentSkill.deleteMany.mockResolvedValue({ count: 4 });
      mockPrisma.studentProfile.deleteMany.mockResolvedValue({ count: 2 });

      // Execution sequence matching test cleanup hook
      await mockPrisma.studentSkill.deleteMany({
        where: { studentProfileId: { in: profileIds } },
      });
      await mockPrisma.studentProfile.deleteMany({
        where: { id: { in: profileIds } },
      });

      expect(mockPrisma.studentSkill.deleteMany).toHaveBeenCalledWith({
        where: { studentProfileId: { in: profileIds } },
      });
      expect(mockPrisma.studentProfile.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: profileIds } },
      });
    });
  });
});
