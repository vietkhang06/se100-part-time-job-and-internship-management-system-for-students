import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModerationStatus, Prisma, UserRole, UserStatus } from '@prisma/client';
import { lockUserRow } from '../../../../shared/database/lock-user-row';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { ListAdminUsersQueryDto } from '../dto/admin-users.dto';

const accountSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const statusTransitions: Record<UserStatus, readonly UserStatus[]> = {
  [UserStatus.PENDING_VERIFICATION]: [],
  [UserStatus.ACTIVE]: [UserStatus.SUSPENDED, UserStatus.LOCKED],
  [UserStatus.SUSPENDED]: [UserStatus.ACTIVE, UserStatus.LOCKED],
  [UserStatus.LOCKED]: [],
};

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAdminUsersQueryDto) {
    const { role, status, page, pageSize } = query;
    const search = query.search?.trim().replace(/[\\%_]/g, '\\$&');
    const where: Prisma.UserWhereInput = {
      role,
      status,
      ...(search ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: accountSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    return { items, total, page, pageSize };
  }

  async detail(id: string) {
    const account = await this.prisma.user.findUnique({ where: { id }, select: accountSelect });
    if (!account) throw new NotFoundException('User not found.');
    return account;
  }

  changeStatus(actorId: string, id: string, status: UserStatus) {
    return this.changeAccount(actorId, id, async (tx, account) => {
      if (account.status === status) return account;
      if (!statusTransitions[account.status].includes(status)) {
        throw new ConflictException('Invalid account status transition.');
      }

      const updated = await tx.user.update({
        where: { id },
        data: {
          status,
          ...(status !== UserStatus.ACTIVE ? { accessTokenVersion: { increment: 1 } } : {}),
        },
        select: accountSelect,
      });
      if (status !== UserStatus.ACTIVE) {
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'USER_STATUS_CHANGED',
          entityType: 'USER',
          entityId: id,
          metadata: { fromStatus: account.status, toStatus: status },
        },
      });
      return updated;
    });
  }

  changeModeratorRole(actorId: string, id: string, enabled: boolean) {
    return this.changeAccount(actorId, id, async (tx, account) => {
      if (!enabled && account.role !== UserRole.MODERATOR) return account;
      if (enabled && account.role === UserRole.MODERATOR) return account;

      let role: UserRole;
      if (enabled) {
        if (account.status !== UserStatus.ACTIVE) {
          throw new ConflictException('Only active accounts can become moderators.');
        }
        role = UserRole.MODERATOR;
      } else {
        const previous = await tx.user.findUniqueOrThrow({
          where: { id },
          select: { roleBeforeModeration: true },
        });
        if (previous.roleBeforeModeration !== UserRole.STUDENT &&
            previous.roleBeforeModeration !== UserRole.EMPLOYER) {
          throw new ConflictException('Previous role must be verified before revocation.');
        }
        const assignment = await tx.moderationItem.findFirst({
          where: { assigneeId: id, status: ModerationStatus.PENDING },
          select: { id: true },
        });
        if (assignment) {
          throw new ConflictException('Reassign pending moderation items before revocation.');
        }
        role = previous.roleBeforeModeration;
      }

      const updated = await tx.user.update({
        where: { id },
        data: { role, roleBeforeModeration: enabled ? account.role : null },
        select: accountSelect,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: enabled ? 'MODERATOR_ROLE_GRANTED' : 'MODERATOR_ROLE_REVOKED',
          entityType: 'USER',
          entityId: id,
          metadata: { fromRole: account.role, toRole: role },
        },
      });
      return updated;
    });
  }

  private async changeAccount(
    actorId: string,
    id: string,
    change: (
      tx: Prisma.TransactionClient,
      account: Prisma.UserGetPayload<{ select: typeof accountSelect }>,
    ) => Promise<Prisma.UserGetPayload<{ select: typeof accountSelect }>>,
  ) {
    if (actorId === id) throw new ForbiddenException('You cannot manage your own account.');
    return this.prisma.$transaction(async (tx) => {
      // Serialize concurrent administrative changes to this account.
      await lockUserRow(tx, id);
      const account = await tx.user.findUnique({ where: { id }, select: accountSelect });
      if (!account) throw new NotFoundException('User not found.');
      if (account.role === UserRole.ADMIN) {
        throw new ForbiddenException('Administrator accounts cannot be modified here.');
      }
      return change(tx, account);
    });
  }
}
