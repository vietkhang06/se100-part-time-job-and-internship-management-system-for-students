import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test'),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return ok when database query succeeds', async () => {
    const result = await service.checkHealth();
    expect(result.status).toBe('ok');
    expect(result.database.status).toBe('up');
    expect(result.environment).toBe('test');
  });

  it('should return error when database query fails', async () => {
    jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('Connection error'));
    const result = await service.checkHealth();
    expect(result.status).toBe('error');
    expect(result.database.status).toBe('down');
  });
});
