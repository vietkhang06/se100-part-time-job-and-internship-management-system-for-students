import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  IStudentProfileRepository,
  UpdateStudentProfileData,
} from '../../domain/repositories/student-profile.repository.interface';
import { StudentProfileEntity } from '../../domain/entities/student-profile.entity';
import { JobSeekingStatus } from '@campusjob/contracts';
import { normalizeSkillList } from '../../domain/services/skill-normalizer';

@Injectable()
export class PrismaStudentProfileRepository
  implements IStudentProfileRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): StudentProfileEntity {
    const user = raw.user;
    const skills: string[] = raw.studentSkills
      ? raw.studentSkills
          .map((ss: any) => ss.skill?.name ?? '')
          .filter((name: string) => name.length > 0)
      : [];

    return new StudentProfileEntity(
      raw.id,
      raw.userId,
      user?.fullName ?? '',
      user?.email ?? '',
      user?.phone ?? null,
      null, // avatarUrl
      raw.university ?? null,
      raw.major ?? null,
      raw.graduationYear ?? null,
      (raw.jobSeekingStatus as JobSeekingStatus) ??
        JobSeekingStatus.ACTIVELY_LOOKING,
      raw.bio ?? null,
      skills,
      false, // isCampusVerified
      null, // campusEmail
      raw.createdAt,
      raw.updatedAt,
    );
  }

  async findById(id: string): Promise<StudentProfileEntity | null> {
    const raw = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: true,
        studentSkills: { include: { skill: true } },
      },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findByUserId(userId: string): Promise<StudentProfileEntity | null> {
    const raw = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        studentSkills: { include: { skill: true } },
      },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async createOrFind(userId: string): Promise<StudentProfileEntity> {
    const raw = await this.prisma.studentProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
      },
      include: {
        user: true,
        studentSkills: { include: { skill: true } },
      },
    });
    return this.toDomain(raw);
  }

  async updateByUserId(
    userId: string,
    data: UpdateStudentProfileData,
  ): Promise<StudentProfileEntity> {
    const updatePayload: Record<string, any> = {};
    if (data.university !== undefined) updatePayload.university = data.university;
    if (data.major !== undefined) updatePayload.major = data.major;
    if (data.graduationYear !== undefined)
      updatePayload.graduationYear = data.graduationYear;
    if (data.jobSeekingStatus !== undefined)
      updatePayload.jobSeekingStatus = data.jobSeekingStatus;
    if (data.bio !== undefined) updatePayload.bio = data.bio;

    if (data.skills !== undefined) {
      const normalizedSkills = normalizeSkillList(data.skills);

      return this.prisma.$transaction(async (tx) => {
        // Upsert basic fields
        const profile = await tx.studentProfile.upsert({
          where: { userId },
          update: updatePayload,
          create: {
            userId,
            ...updatePayload,
          },
        });

        // Reconcile normalized canonical skills
        const skillIds: string[] = [];
        for (const item of normalizedSkills) {
          const record = await tx.skill.upsert({
            where: { normalizedName: item.normalizedName },
            update: {},
            create: {
              name: item.displayName,
              normalizedName: item.normalizedName,
            },
          });
          skillIds.push(record.id);
        }

        // Delete removed associations
        await tx.studentSkill.deleteMany({
          where: {
            studentProfileId: profile.id,
            skillId: { notIn: skillIds },
          },
        });

        // Upsert current associations
        for (const skillId of skillIds) {
          await tx.studentSkill.upsert({
            where: {
              studentProfileId_skillId: {
                studentProfileId: profile.id,
                skillId,
              },
            },
            update: {},
            create: {
              studentProfileId: profile.id,
              skillId,
            },
          });
        }

        const fresh = await tx.studentProfile.findUnique({
          where: { id: profile.id },
          include: {
            user: true,
            studentSkills: { include: { skill: true } },
          },
        });

        return this.toDomain(fresh);
      });
    }

    const raw = await this.prisma.studentProfile.upsert({
      where: { userId },
      update: updatePayload,
      create: {
        userId,
        ...updatePayload,
      },
      include: {
        user: true,
        studentSkills: { include: { skill: true } },
      },
    });
    return this.toDomain(raw);
  }
}
