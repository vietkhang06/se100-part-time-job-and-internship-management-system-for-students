import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  ICvRepository,
  CreateCvData,
  UpdateCvData,
} from '../../domain/repositories/cv.repository.interface';
import { CvEntity } from '../../domain/entities/cv.entity';

@Injectable()
export class PrismaCvRepository implements ICvRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): CvEntity {
    const userId = raw.studentProfile?.userId ?? '';
    return new CvEntity(
      raw.id,
      raw.studentProfileId,
      userId,
      raw.title,
      raw.summary ?? null,
      raw.isDefault,
      raw.fileUrl ?? null,
      raw.skills ?? [],
      (raw.educations as any[]) ?? [],
      (raw.experiences as any[]) ?? [],
      (raw.projects as any[]) ?? [],
      (raw.certifications as any[]) ?? [],
      raw.createdAt,
      raw.updatedAt,
    );
  }

  async findByStudentProfileId(studentProfileId: string): Promise<CvEntity[]> {
    const rows = await this.prisma.cv.findMany({
      where: { studentProfileId },
      include: { studentProfile: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<CvEntity | null> {
    const row = await this.prisma.cv.findUnique({
      where: { id },
      include: { studentProfile: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async countByStudentProfileId(studentProfileId: string): Promise<number> {
    return this.prisma.cv.count({
      where: { studentProfileId },
    });
  }

  async create(data: CreateCvData): Promise<CvEntity> {
    const isDefault = data.isDefault ?? false;

    if (isDefault) {
      return this.prisma.$transaction(async (tx) => {
        await tx.cv.updateMany({
          where: { studentProfileId: data.studentProfileId },
          data: { isDefault: false },
        });

        const created = await tx.cv.create({
          data: {
            studentProfileId: data.studentProfileId,
            title: data.title,
            summary: data.summary ?? null,
            isDefault: true,
            fileUrl: data.fileUrl ?? null,
            skills: data.skills ?? [],
            educations: (data.educations as any) ?? [],
            experiences: (data.experiences as any) ?? [],
            projects: (data.projects as any) ?? [],
            certifications: (data.certifications as any) ?? [],
          },
          include: { studentProfile: true },
        });

        return this.toDomain(created);
      });
    }

    const created = await this.prisma.cv.create({
      data: {
        studentProfileId: data.studentProfileId,
        title: data.title,
        summary: data.summary ?? null,
        isDefault: false,
        fileUrl: data.fileUrl ?? null,
        skills: data.skills ?? [],
        educations: (data.educations as any) ?? [],
        experiences: (data.experiences as any) ?? [],
        projects: (data.projects as any) ?? [],
        certifications: (data.certifications as any) ?? [],
      },
      include: { studentProfile: true },
    });

    return this.toDomain(created);
  }

  async update(id: string, data: UpdateCvData): Promise<CvEntity> {
    if (data.isDefault === true) {
      return this.prisma.$transaction(async (tx) => {
        const existing = await tx.cv.findUnique({
          where: { id },
        });

        if (existing) {
          await tx.cv.updateMany({
            where: { studentProfileId: existing.studentProfileId },
            data: { isDefault: false },
          });
        }

        const updatePayload: Record<string, any> = { isDefault: true };
        if (data.title !== undefined) updatePayload.title = data.title;
        if (data.summary !== undefined) updatePayload.summary = data.summary;
        if (data.fileUrl !== undefined) updatePayload.fileUrl = data.fileUrl;
        if (data.skills !== undefined) updatePayload.skills = data.skills;
        if (data.educations !== undefined) updatePayload.educations = data.educations;
        if (data.experiences !== undefined) updatePayload.experiences = data.experiences;
        if (data.projects !== undefined) updatePayload.projects = data.projects;
        if (data.certifications !== undefined) updatePayload.certifications = data.certifications;

        const updated = await tx.cv.update({
          where: { id },
          data: updatePayload,
          include: { studentProfile: true },
        });

        return this.toDomain(updated);
      });
    }

    const updatePayload: Record<string, any> = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.summary !== undefined) updatePayload.summary = data.summary;
    if (data.isDefault !== undefined) updatePayload.isDefault = data.isDefault;
    if (data.fileUrl !== undefined) updatePayload.fileUrl = data.fileUrl;
    if (data.skills !== undefined) updatePayload.skills = data.skills;
    if (data.educations !== undefined) updatePayload.educations = data.educations;
    if (data.experiences !== undefined) updatePayload.experiences = data.experiences;
    if (data.projects !== undefined) updatePayload.projects = data.projects;
    if (data.certifications !== undefined) updatePayload.certifications = data.certifications;

    const updated = await this.prisma.cv.update({
      where: { id },
      data: updatePayload,
      include: { studentProfile: true },
    });

    return this.toDomain(updated);
  }

  async setDefault(studentProfileId: string, cvId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.cv.updateMany({
        where: { studentProfileId },
        data: { isDefault: false },
      });
      await tx.cv.update({
        where: { id: cvId },
        data: { isDefault: true },
      });
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.cv.delete({
      where: { id },
    });
  }

  async findDefaultByStudentProfileId(
    studentProfileId: string,
  ): Promise<CvEntity | null> {
    const row = await this.prisma.cv.findFirst({
      where: { studentProfileId, isDefault: true },
      include: { studentProfile: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async findLatestByStudentProfileId(
    studentProfileId: string,
    excludeId?: string,
  ): Promise<CvEntity | null> {
    const row = await this.prisma.cv.findFirst({
      where: {
        studentProfileId,
        id: excludeId ? { not: excludeId } : undefined,
      },
      include: { studentProfile: true },
      orderBy: { updatedAt: 'desc' },
    });
    return row ? this.toDomain(row) : null;
  }

  async isCvInUse(cvId: string): Promise<boolean> {
    // Contract C-03: Kiểm tra nếu có hồ sơ ứng tuyển liên kết với cvId
    if ('application' in this.prisma) {
      const count = await (this.prisma as any).application.count({
        where: {
          cvId,
          status: {
            notIn: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
          },
        },
      });
      return count > 0;
    }
    return false;
  }
}
