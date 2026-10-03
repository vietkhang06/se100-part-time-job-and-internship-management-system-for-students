import { LogoutAllUseCase } from './logout-all.use-case';
import { IAuthSessionRepository } from '../../domain/repositories/auth-session.repository.interface';

describe('LogoutAllUseCase', () => {
  let useCase: LogoutAllUseCase;
  let authSessionRepository: jest.Mocked<IAuthSessionRepository>;

  beforeEach(() => {
    authSessionRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      findById: jest.fn(),
      revokeById: jest.fn(),
      revokeFamily: jest.fn(),
      revokeAllForUser: jest.fn(),
      rotateSession: jest.fn(),
    };

    useCase = new LogoutAllUseCase(authSessionRepository);
  });

  it('should revoke all sessions for given user id', async () => {
    const result = await useCase.execute('user-target-id');

    expect(result.ok).toBe(true);
    expect(authSessionRepository.revokeAllForUser).toHaveBeenCalledWith('user-target-id');
  });
});
