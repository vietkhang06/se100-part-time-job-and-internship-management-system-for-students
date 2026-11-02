import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthContext, UserRole, UserStatus } from '@campusjob/contracts';
import { UserEntity } from '../../domain/entities/user.entity';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { GetUserByIdUseCase } from './get-user-by-id.use-case';

describe('GetUserByIdUseCase', () => {
  const selfId = 'self-id';
  const otherId = 'other-id';
  let repository: jest.Mocked<Pick<IUserRepository, 'findById'>>;
  let useCase: GetUserByIdUseCase;

  const requester = (id: string, role: UserRole): AuthContext => ({
    id,
    email: `${id}@example.com`,
    fullName: id,
    role,
    status: UserStatus.ACTIVE,
    emailVerified: true,
  });

  const account = new UserEntity(
    otherId,
    'other@example.com',
    'secret-hash',
    'Other User',
    UserRole.STUDENT,
    UserStatus.ACTIVE,
    '+10000000000',
    new Date('2026-01-01T00:00:00.000Z'),
  );

  beforeEach(() => {
    repository = { findById: jest.fn() };
    useCase = new GetUserByIdUseCase(repository as unknown as IUserRepository);
  });

  it.each([UserRole.STUDENT, UserRole.EMPLOYER, UserRole.MODERATOR, UserRole.ADMIN])(
    'allows %s to view their own account',
    async (role) => {
      repository.findById.mockResolvedValue(account);

      await expect(useCase.execute(otherId, requester(otherId, role))).resolves.toMatchObject({
        id: otherId,
        email: 'other@example.com',
        fullName: 'Other User',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      });
      expect(repository.findById).toHaveBeenCalledWith(otherId);
    },
  );

  it.each([UserRole.STUDENT, UserRole.EMPLOYER, UserRole.MODERATOR])(
    'denies %s access to another account before querying the repository',
    async (role) => {
      await expect(useCase.execute(otherId, requester(selfId, role))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.findById).not.toHaveBeenCalled();
    },
  );

  it('allows ADMIN to view another account', async () => {
    repository.findById.mockResolvedValue(account);

    await expect(useCase.execute(otherId, requester(selfId, UserRole.ADMIN))).resolves.toMatchObject({
      id: otherId,
      email: 'other@example.com',
    });
    expect(repository.findById).toHaveBeenCalledWith(otherId);
  });

  it('returns only the public user response fields', async () => {
    repository.findById.mockResolvedValue(account);

    const result = await useCase.execute(otherId, requester(selfId, UserRole.ADMIN));

    expect(Object.keys(result).sort()).toEqual(
      ['email', 'emailVerified', 'fullName', 'id', 'role', 'status'].sort(),
    );
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('phone');
  });

  it('returns 404 for an authorized missing account', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute(otherId, requester(selfId, UserRole.ADMIN))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
