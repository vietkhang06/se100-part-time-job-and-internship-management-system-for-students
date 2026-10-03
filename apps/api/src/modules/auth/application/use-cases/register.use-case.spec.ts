import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserRole, UserStatus } from '@campusjob/contracts';
import { RegisterUseCase } from './register.use-case';
import { IUserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { IMailService } from '../../../../shared/mail/mail.service.interface';
import { UserEntity } from '../../../users/domain/entities/user.entity';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let mailService: jest.Mocked<IMailService>;

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      createWithVerificationToken: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    mailService = {
      sendMail: jest.fn(),
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };

    useCase = new RegisterUseCase(userRepository, mailService);
  });

  it('should successfully register a student account', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.createWithVerificationToken.mockImplementation(async (userData) => ({
      user: new UserEntity(
        'user-uuid-1',
        userData.email,
        userData.passwordHash,
        userData.fullName,
        userData.role,
        userData.status,
        userData.phone,
        userData.emailVerifiedAt,
      ),
      tokenId: 'token-uuid-1',
    }));

    const result = await useCase.execute({
      email: ' Student@example.com ',
      fullName: 'Nguyen Van Sinh Vien',
      password: 'StrongPassword123!',
      role: UserRole.STUDENT,
      phone: '0901234567',
    });

    expect(result).toHaveProperty('message');
    expect(result.user.email).toBe('student@example.com');
    expect(result.user.role).toBe(UserRole.STUDENT);
    expect(result.user.emailVerified).toBe(false);
    expect((result.user as any).passwordHash).toBeUndefined();
    expect((result as any).token).toBeUndefined();

    expect(userRepository.findByEmail).toHaveBeenCalledWith('student@example.com');
    expect(userRepository.createWithVerificationToken).toHaveBeenCalled();
    expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
      'student@example.com',
      expect.any(String),
    );
  });

  it('should successfully register an employer account', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.createWithVerificationToken.mockImplementation(async (userData) => ({
      user: new UserEntity(
        'user-uuid-2',
        userData.email,
        userData.passwordHash,
        userData.fullName,
        userData.role,
        userData.status,
      ),
      tokenId: 'token-uuid-2',
    }));

    const result = await useCase.execute({
      email: 'HR@company.com',
      fullName: 'Tran Thi Nhat Tuyen Dung',
      password: 'StrongPassword123!',
      role: UserRole.EMPLOYER,
    });

    expect(result.user.email).toBe('hr@company.com');
    expect(result.user.role).toBe(UserRole.EMPLOYER);
  });

  it('should reject registration with ADMIN or MODERATOR role', async () => {
    await expect(
      useCase.execute({
        email: 'admin@campusjob.local',
        fullName: 'Fake Admin',
        password: 'StrongPassword123!',
        role: UserRole.ADMIN as any,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute({
        email: 'mod@campusjob.local',
        fullName: 'Fake Mod',
        password: 'StrongPassword123!',
        role: UserRole.MODERATOR as any,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(userRepository.createWithVerificationToken).not.toHaveBeenCalled();
  });

  it('should reject registration when email already exists', async () => {
    userRepository.findByEmail.mockResolvedValue(
      new UserEntity(
        'existing-id',
        'student@example.com',
        'hash',
        'Existing',
        UserRole.STUDENT,
        UserStatus.ACTIVE,
      ),
    );

    await expect(
      useCase.execute({
        email: 'student@example.com',
        fullName: 'Nguyen Van A',
        password: 'StrongPassword123!',
        role: UserRole.STUDENT,
      }),
    ).rejects.toThrow(ConflictException);

    expect(userRepository.createWithVerificationToken).not.toHaveBeenCalled();
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('should reject password that does not satisfy policy', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    // Missing special character and uppercase
    await expect(
      useCase.execute({
        email: 'student@example.com',
        fullName: 'Nguyen Van A',
        password: 'simplepassword1',
        role: UserRole.STUDENT,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(userRepository.createWithVerificationToken).not.toHaveBeenCalled();
  });

  it('should hash password using Argon2id', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    let capturedPasswordHash = '';
    userRepository.createWithVerificationToken.mockImplementation(async (userData) => {
      capturedPasswordHash = userData.passwordHash;
      return {
        user: new UserEntity(
          'user-uuid',
          userData.email,
          userData.passwordHash,
          userData.fullName,
          userData.role,
          userData.status,
        ),
        tokenId: 'token-uuid',
      };
    });

    await useCase.execute({
      email: 'student@example.com',
      fullName: 'Nguyen Van A',
      password: 'StrongPassword123!',
      role: UserRole.STUDENT,
    });

    expect(capturedPasswordHash).not.toBe('StrongPassword123!');
    const isMatch = await PasswordHasher.verify(
      capturedPasswordHash,
      'StrongPassword123!',
    );
    expect(isMatch).toBe(true);
  });
});
