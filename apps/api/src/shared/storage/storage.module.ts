import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_SERVICE_TOKEN, StorageException } from './storage.interface';
import { LocalStorageService } from './local-storage.service';
import { FileAssetService } from './file-asset.service';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE_TOKEN,
      useFactory: (configService: ConfigService) => {
        const driver = configService.get<string>('STORAGE_DRIVER', 'local');
        if (driver === 'local') {
          return new LocalStorageService(configService);
        }
        throw new StorageException(
          `Unsupported STORAGE_DRIVER '${driver}'. Only 'local' is supported in the current environment.`,
        );
      },
      inject: [ConfigService],
    },
    FileAssetService,
  ],
  exports: [STORAGE_SERVICE_TOKEN, FileAssetService],
})
export class StorageModule {}
