import { ConfigService } from '@nestjs/config';
import { EmailRetrySchedulerService } from './email-retry-scheduler.service';
import {
  RetryEmailsSummary,
  RetryPendingNotificationEmailsUseCase,
} from '../use-cases/retry-pending-notification-emails.use-case';

describe('EmailRetrySchedulerService (R-M05-03)', () => {
  let service: EmailRetrySchedulerService;
  let mockRetryUseCase: jest.Mocked<RetryPendingNotificationEmailsUseCase>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockRetryUseCase = {
      execute: jest.fn().mockResolvedValue({
        picked: 2,
        sent: 2,
        failed: 0,
        skipped: 0,
      } as RetryEmailsSummary),
    } as unknown as jest.Mocked<RetryPendingNotificationEmailsUseCase>;

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'ENABLE_EMAIL_RETRY_SCHEDULER') return 'true';
        if (key === 'EMAIL_RETRY_INTERVAL_MS') return '60000';
        if (key === 'EMAIL_RETRY_BATCH_LIMIT') return '50';
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new EmailRetrySchedulerService(
      mockConfigService,
      mockRetryUseCase,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  describe('Lifecycle and initialization', () => {
    it('khởi tạo timer với chu kỳ mặc định 60 giây khi ENABLE_EMAIL_RETRY_SCHEDULER=true', async () => {
      service.onModuleInit();

      // Tiến trình timer chưa chạy ngay trong onModuleInit (chờ hết 60s)
      expect(mockRetryUseCase.execute).not.toHaveBeenCalled();

      // Sau 60s, timer kích hoạt runRetryCheck lần đầu
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
      expect(mockRetryUseCase.execute).toHaveBeenCalledTimes(1);

      // Sau thêm 60s, kích hoạt lần 2
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
      expect(mockRetryUseCase.execute).toHaveBeenCalledTimes(2);
    });

    it('tôn trọng cấu hình EMAIL_RETRY_INTERVAL_MS tùy chỉnh', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'ENABLE_EMAIL_RETRY_SCHEDULER') return 'true';
          if (key === 'EMAIL_RETRY_INTERVAL_MS') return '30000';
          return defaultValue;
        },
      );

      service.onModuleInit();

      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      expect(mockRetryUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('không khởi tạo timer khi ENABLE_EMAIL_RETRY_SCHEDULER=false', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'ENABLE_EMAIL_RETRY_SCHEDULER') return 'false';
          return defaultValue;
        },
      );

      service.onModuleInit();
      jest.advanceTimersByTime(120000);

      expect(mockRetryUseCase.execute).not.toHaveBeenCalled();
    });

    it('dọn dẹp timer khi onModuleDestroy được gọi', () => {
      service.onModuleInit();
      service.onModuleDestroy();

      jest.advanceTimersByTime(120000);
      expect(mockRetryUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('Chống chạy đè (Overlapping Execution Prevention)', () => {
    it('ngăn chạy đè khi lần chạy trước chưa hoàn thành và trả SKIPPED_OVERLAPPING', async () => {
      // Giả lập use case đang xử lý mất 100ms
      let resolvePromise: (value: RetryEmailsSummary) => void;
      const slowExecution = new Promise<RetryEmailsSummary>((resolve) => {
        resolvePromise = resolve;
      });
      mockRetryUseCase.execute.mockReturnValueOnce(slowExecution);

      // Kích hoạt run 1
      const promise1 = service.runRetryCheck('corr-1');

      // Trong khi run 1 chưa xong, kích hoạt run 2
      const result2 = await service.runRetryCheck('corr-2');

      expect(result2.status).toBe('SKIPPED_OVERLAPPING');
      expect(result2.picked).toBe(0);
      expect(result2.sent).toBe(0);

      // Hoàn tất run 1
      resolvePromise!({ picked: 1, sent: 1, failed: 0, skipped: 0 });
      const result1 = await promise1;

      expect(result1.status).toBe('COMPLETED');
      expect(result1.picked).toBe(1);
      expect(result1.sent).toBe(1);

      // Chỉ có đúng 1 lần gọi use case execute
      expect(mockRetryUseCase.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('Khả năng chịu lỗi (Error Resilience)', () => {
    it('bắt lỗi khi use case hoặc DB gặp sự cố và không làm crash tiến trình', async () => {
      mockRetryUseCase.execute.mockRejectedValueOnce(
        new Error('Database connection timeout'),
      );

      const result = await service.runRetryCheck('corr-err');

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Database connection timeout');

      // Cờ isRunning phải được đặt lại false trong finally, cho phép lần chạy tiếp theo
      mockRetryUseCase.execute.mockResolvedValueOnce({
        picked: 1,
        sent: 1,
        failed: 0,
        skipped: 0,
      });

      const nextResult = await service.runRetryCheck('corr-recovery');
      expect(nextResult.status).toBe('COMPLETED');
      expect(nextResult.sent).toBe(1);
    });
  });

  describe('Correlation ID', () => {
    it('sử dụng correlation ID tùy biến nếu được cung cấp', async () => {
      const customCorrelationId = 'test-trace-id-999';
      const result = await service.runRetryCheck(customCorrelationId);

      expect(result.correlationId).toBe(customCorrelationId);
      expect(result.status).toBe('COMPLETED');
    });

    it('tự sinh UUID correlation ID nếu không được cung cấp', async () => {
      const result = await service.runRetryCheck();

      expect(typeof result.correlationId).toBe('string');
      expect(result.correlationId.length).toBeGreaterThan(10);
      expect(result.status).toBe('COMPLETED');
    });
  });
});
