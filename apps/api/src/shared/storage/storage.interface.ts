export const STORAGE_SERVICE_TOKEN = Symbol('STORAGE_SERVICE_TOKEN');

export interface StoredFileResult {
  storageKey: string;
  byteSize: number;
  checksumSha256: string;
}

export interface StoreFileOptions {
  buffer: Buffer;
  originalFilename?: string;
  mimeType?: string;
}

export interface IStorageService {
  store(options: StoreFileOptions): Promise<StoredFileResult>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
  getStorageRoot(): string;
}

export class StorageException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageException';
  }
}

export class StoragePathTraversalException extends StorageException {
  constructor(message: string = 'Potential path traversal detected in storage operation') {
    super(message);
    this.name = 'StoragePathTraversalException';
  }
}

export class InvalidStorageKeyException extends StorageException {
  constructor(message: string = 'Invalid storage key supplied') {
    super(message);
    this.name = 'InvalidStorageKeyException';
  }
}

export class FileNotFoundException extends StorageException {
  constructor(message: string = 'Requested file not found in storage') {
    super(message);
    this.name = 'FileNotFoundException';
  }
}
