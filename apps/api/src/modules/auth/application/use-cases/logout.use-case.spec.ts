import { LogoutUseCase } from './logout.use-case';
import { IAuthSessionRepository } from '../../domain/repositories/auth-session.repository.interface';
import { AuthSessionEntity } from '../../domain/entities/auth-session.entity';

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;
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

    useCase = new LogoutUseCase(authSessionRepository);
  });

  it('should revoke session if valid refresh token is passed', async () => {
    const session = new AuthSessionEntity(
      'session-1',
      'user-1',
      'hash',
      'family-1',
      new Date(),
      null,
    );
    authSessionRepository.findByTokenHash.mockResolvedValue(session);

    const result = await useCase.execute('valid_refresh_token');

    expect(result.ok).toBe(true);
    expect(authSessionRepository.revokeById).toHaveBeenCalledWith('session-1');
  });

  it('should return ok: true even if token is not passed or not found', async () => {
    authSessionRepository.findByTokenHash.mockResolvedValue(null);

    const result = await useCase.execute(undefined);
    expect(result.ok).toBe(true);
    expect(authSessionRepository.revokeById).not.toHaveBeenCalled();
  });
});
