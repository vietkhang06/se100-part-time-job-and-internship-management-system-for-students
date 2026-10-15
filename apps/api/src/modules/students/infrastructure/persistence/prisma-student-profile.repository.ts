import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  IStudentProfileRepository,
  UpdateStudentProfileData,
} from '../../domain/repositories/student-profile.repository.interface';
import { StudentProfileEntity } from '../../domain/entities/student-profile.entity';
import { JobSeekingStatus } from '@campusjob/contracts';

@Injectable()
export class PrismaStudentProfileRepository
  implements IStudentProfileRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): StudentProfileEntity {
    const user = raw.user;
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
      raw.skills ?? [],
      false, // isCampusVerified
      null, // campusEmail
      raw.createdAt,
      raw.updatedAt,
    );
  }

  async findById(id: string): Promise<StudentProfileEntity | null> {
    const raw = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: { user: true },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findByUserId(userId: string): Promise<StudentProfileEntity | null> {
    const raw = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: { user: true },
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
        skills: [],
      },
      include: { user: true },
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
    if (data.skills !== undefined) updatePayload.skills = data.skills;

    const raw = await this.prisma.studentProfile.upsert({
      where: { userId },
      update: updatePayload,
      create: {
        userId,
        ...updatePayload,
      },
      include: { user: true },
    });
    return this.toDomain(raw);
  }
}
