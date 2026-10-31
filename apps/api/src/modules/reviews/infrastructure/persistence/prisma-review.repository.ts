import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReviewVisibility } from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { ReviewEntity } from '../../domain/entities/review.entity';
import {
  CreateReviewData,
  IReviewRepository,
  ReviewSummary,
} from '../../domain/repositories/review.repository.interface';

@Injectable()
export class PrismaReviewRepository implements IReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: Prisma.ReviewGetPayload<{ include: { reply: true } }>): ReviewEntity {
    return new ReviewEntity({
      id: raw.id,
      applicationId: raw.applicationId,
      studentId: raw.studentId,
      companyId: raw.companyId,
      rating: raw.rating,
      comment: raw.comment ?? null,
      visibility: raw.visibility as ReviewVisibility,
      createdAt: raw.createdAt,
      reply: raw.reply
        ? { employerId: raw.reply.employerId, content: raw.reply.content, createdAt: raw.reply.createdAt }
        : null,
    });
  }

  async create(data: CreateReviewData): Promise<{ review: ReviewEntity | null; duplicate: boolean }> {
    try {
      const raw = await this.prisma.review.create({
        data: {
          applicationId: data.applicationId,
          studentId: data.studentId,
          companyId: data.companyId,
          rating: data.rating,
          comment: data.comment,
        },
        include: { reply: true },
      });
      return { review: this.toDomain(raw), duplicate: false };
    } catch (err: unknown) {
      // applicationId UNIQUE: mỗi hồ sơ ứng tuyển chỉ có một đánh giá, kể cả khi hai request chạy song song.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { review: null, duplicate: true };
      }
      throw err;
    }
  }

  async findById(id: string): Promise<ReviewEntity | null> {
    const raw = await this.prisma.review.findUnique({ where: { id }, include: { reply: true } });
    return raw ? this.toDomain(raw) : null;
  }

  async listByStudent(
    studentId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ReviewEntity[]; total: number }> {
    const where = { studentId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: { reply: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async listVisibleByCompany(
    companyId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ReviewEntity[]; total: number }> {
    const where = { companyId, visibility: ReviewVisibility.VISIBLE };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: { reply: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async summarizeVisibleByCompany(companyId: string): Promise<ReviewSummary> {
    const where = { companyId, visibility: ReviewVisibility.VISIBLE };
    const grouped = await this.prisma.review.groupBy({
      by: ['rating'],
      where,
      _count: { _all: true },
    });

    const distribution: ReviewSummary['distribution'] = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let total = 0;
    let sum = 0;
    for (const row of grouped) {
      const key = String(row.rating) as keyof ReviewSummary['distribution'];
      if (key in distribution) distribution[key] = row._count._all;
      total += row._count._all;
      sum += row.rating * row._count._all;
    }
    return { averageRating: total === 0 ? null : sum / total, totalReviews: total, distribution };
  }

  async createReply(data: {
    reviewId: string;
    employerId: string;
    content: string;
  }): Promise<{ created: boolean }> {
    try {
      await this.prisma.reviewReply.create({
        data: { reviewId: data.reviewId, employerId: data.employerId, content: data.content },
      });
      return { created: true };
    } catch (err: unknown) {
      // reviewId UNIQUE: chỉ một phản hồi cho mỗi đánh giá.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { created: false };
      }
      throw err;
    }
  }

  async setVisibility(id: string, visibility: ReviewVisibility): Promise<boolean> {
    const result = await this.prisma.review.updateMany({ where: { id }, data: { visibility } });
    return result.count === 1;
  }
}
