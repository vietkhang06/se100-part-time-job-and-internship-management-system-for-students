import { PrismaStudentProfileRepository } from './prisma-student-profile.repository';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { JobSeekingStatus } from '@campusjob/contracts';

describe('PrismaStudentProfileRepository (W2-DB-01 Skill Normalization & Persistence)', () => {
  let repository: PrismaStudentProfileRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      studentProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      skill: {
        upsert: jest.fn(),
      },
      studentSkill: {
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };

    repository = new PrismaStudentProfileRepository(mockPrisma as PrismaService);
  });

  describe('toDomain mapping with normalized studentSkills', () => {
    it('should extract skill display names from normalized studentSkills relation', async () => {
      const rawDbRecord = {
        id: 'profile-1',
        userId: 'user-1',
        university: 'UIT',
        major: 'SE',
        graduationYear: 2025,
        jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
        bio: 'Hello',
        user: {
          fullName: 'Nguyen Van A',
          email: 'student@example.com',
          phone: null,
        },
        studentSkills: [
          { skill: { id: 's1', name: 'TypeScript', normalizedName: 'typescript' } },
          { skill: { id: 's2', name: 'NestJS', normalizedName: 'nestjs' } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.studentProfile.findUnique.mockResolvedValue(rawDbRecord);

      const profile = await repository.findByUserId('user-1');

      expect(profile).not.toBeNull();
      expect(profile!.skills).toEqual(['TypeScript', 'NestJS']);
    });

    it('should return empty skills array if studentSkills is undefined or empty', async () => {
      const rawDbRecord = {
        id: 'profile-2',
        userId: 'user-2',
        jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
        user: { fullName: 'B', email: 'b@example.com' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.studentProfile.findUnique.mockResolvedValue(rawDbRecord);

      const profile = await repository.findByUserId('user-2');

      expect(profile).not.toBeNull();
      expect(profile!.skills).toEqual([]);
    });

    it('should load profile with normalized skills by id (findById)', async () => {
      const rawDbRecord = {
        id: 'profile-3',
        userId: 'user-3',
        user: { fullName: 'C', email: 'c@example.com' },
        studentSkills: [
          { skill: { id: 's1', name: 'Docker', normalizedName: 'docker' } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.studentProfile.findUnique.mockResolvedValue(rawDbRecord);

      const profile = await repository.findById('profile-3');

      expect(profile).not.toBeNull();
      expect(profile!.skills).toEqual(['Docker']);
      expect(mockPrisma.studentProfile.findUnique).toHaveBeenCalledWith({
        where: { id: 'profile-3' },
        include: {
          user: true,
          studentSkills: { include: { skill: true } },
        },
      });
    });
  });

  describe('updateByUserId with skill normalization transaction', () => {
    it('should normalize skills, upsert canonical skills, and reconcile studentSkill associations', async () => {
      const profileId = 'profile-1';
      mockPrisma.studentProfile.upsert.mockResolvedValue({
        id: profileId,
        userId: 'user-1',
      });

      mockPrisma.skill.upsert.mockImplementation(({ where, create }: any) => {
        return Promise.resolve({
          id: `id-${where.normalizedName}`,
          name: create.name,
          normalizedName: where.normalizedName,
        });
      });

      mockPrisma.studentSkill.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.studentSkill.upsert.mockResolvedValue({});

      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: profileId,
        userId: 'user-1',
        jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
        user: { fullName: 'A', email: 'a@example.com' },
        studentSkills: [
          { skill: { id: 'id-react', name: 'React', normalizedName: 'react' } },
          { skill: { id: 'id-typescript', name: 'TypeScript', normalizedName: 'typescript' } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await repository.updateByUserId('user-1', {
        skills: [' React ', 'react', 'REACT', '  ', 'TypeScript'],
      });

      // Verify transaction called
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // Verify Skill.upsert called for deduplicated canonical skills only (2 times: react, typescript)
      expect(mockPrisma.skill.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.skill.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { normalizedName: 'react' },
        }),
      );
      expect(mockPrisma.skill.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { normalizedName: 'typescript' },
        }),
      );

      // Verify StudentSkill.deleteMany removes obsolete associations
      expect(mockPrisma.studentSkill.deleteMany).toHaveBeenCalledWith({
        where: {
          studentProfileId: profileId,
          skillId: { notIn: ['id-react', 'id-typescript'] },
        },
      });

      // Verify StudentSkill.upsert creates current associations
      expect(mockPrisma.studentSkill.upsert).toHaveBeenCalledTimes(2);

      // Verify returned domain entity has cleaned display names
      expect(result.skills).toEqual(['React', 'TypeScript']);
    });
  });
});
