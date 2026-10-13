import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthErrorCode, UserRole, UserStatus } from '@campusjob/contracts';
import { ChangePasswordUseCase } from './change-password.use-case';
import { IUserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { UserEntity } from '../../../users/domain/entities/user.entity';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';

describe('ChangePasswordUseCase', () => {
  let useCase: ChangePasswordUseCase;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      createWithVerificationToken: jest.fn(),
      updateStatus: jest.fn(),
      updatePassword: jest.fn(),
      changePasswordAndRevokeSessions: jest.fn(),
    };

    useCase = new ChangePasswordUseCase(userRepository);
  });

  it('should successfully change password with valid current password and strong new password', async () => {
    const currentPassword = 'CurrentSecurePass123!';
    const passwordHash = await PasswordHasher.hash(currentPassword);

    const user = new UserEntity(
      'user-1',
      'user@example.com',
      passwordHash,
      'John Doe',
      UserRole.STUDENT,
      UserStatus.ACTIVE,
      null,
      new Date(),
      new Date(),
      new Date(),
    );

    userRepository.findById.mockResolvedValue(user);

    let capturedNewHash = '';
    userRepository.changePasswordAndRevokeSessions.mockImplementation(
      async (_uid, newHash) => {
        capturedNewHash = newHash;
      },
    );

    const result = await useCase.execute('user-1', {
      currentPassword,
      newPassword: 'BrandNewSecurePass456!',
    });

    expect(result.message).toContain('Password has been changed successfully');
    expect(userRepository.changePasswordAndRevokeSessions).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
    );

    const isMatch = await PasswordHasher.verify(
      capturedNewHash,
      'BrandNewSecurePass456!',
    );
    expect(isMatch).toBe(true);
  });

  it('should throw UnauthorizedException when user is not found', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('non-existent-user', {
        currentPassword: 'CurrentPass123!',
        newPassword: 'NewPass123!@#',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw BadRequestException with INVALID_CREDENTIALS when current password is incorrect', async () => {
    const passwordHash = await PasswordHasher.hash('CorrectPass123!');

    const user = new UserEntity(
      'user-1',
      'user@example.com',
      passwordHash,
      'John Doe',
      UserRole.STUDENT,
      UserStatus.ACTIVE,
    );

    userRepository.findById.mockResolvedValue(user);

    try {
      await useCase.execute('user-1', {
        currentPassword: 'WrongPassword123!',
        newPassword: 'BrandNewSecurePass456!',
      });
      fail('Expected BadRequestException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse().code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      expect(err.getResponse().message).toContain('Current password is incorrect');
    }
  });

  it('should throw BadRequestException with VALIDATION_ERROR when new password is identical to current password', async () => {
    const password = 'IdenticalPassword123!';
    const passwordHash = await PasswordHasher.hash(password);

    const user = new UserEntity(
      'user-1',
      'user@example.com',
      passwordHash,
      'John Doe',
      UserRole.STUDENT,
      UserStatus.ACTIVE,
    );

    userRepository.findById.mockResolvedValue(user);

    try {
      await useCase.execute('user-1', {
        currentPassword: password,
        newPassword: password,
      });
      fail('Expected BadRequestException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse().code).toBe(AuthErrorCode.VALIDATION_ERROR);
      expect(err.getResponse().message).toContain('must be different');
    }
  });

  it('should throw BadRequestException with WEAK_PASSWORD when new password does not satisfy complexity policy', async () => {
    const currentPassword = 'CurrentSecurePass123!';
    const passwordHash = await PasswordHasher.hash(currentPassword);

    const user = new UserEntity(
      'user-1',
      'user@example.com',
      passwordHash,
      'John Doe',
      UserRole.STUDENT,
      UserStatus.ACTIVE,
    );

    userRepository.findById.mockResolvedValue(user);

    try {
      await useCase.execute('user-1', {
        currentPassword,
        newPassword: 'weak',
      });
      fail('Expected BadRequestException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse().code).toBe(AuthErrorCode.WEAK_PASSWORD);
    }
  });
});
