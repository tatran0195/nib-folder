import { Readable } from 'node:stream';
import { BaseStorage, type CorsRuleInput, type HeadObjectResult, type PresignGetOptions, type PresignPutOptions } from './base';
import type { StorageTarget } from './client';
import { keys } from './keys';
import { LocalStorage } from './local';
import { S3Storage } from './s3';

export { BaseStorage, inferContentType, type CorsRuleInput, type HeadObjectResult, type PresignGetOptions, type PresignPutOptions } from './base';
export { defaultTarget, getBucket, getPublicBaseUrl, getS3Client, publicTarget, type StorageTarget } from './client';
export { LocalStorage } from './local';
export { S3Storage } from './s3';
export { createStorageRouter, storageRouter } from './router';

let storageInstance: BaseStorage | undefined;

export const getStorage = (): BaseStorage => {
  if (!storageInstance) {
    const provider = keys().STORAGE_PROVIDER;
    if (provider === 'local') {
      storageInstance = new LocalStorage();
    } else {
      storageInstance = new S3Storage();
    }
  }
  return storageInstance;
};

// Top-level backward-compatible function facades
export const ensureBucket = (target?: StorageTarget): Promise<void> => getStorage().ensureBucket(target);

export const putObject = (
  key: string,
  body: Buffer | Uint8Array | string | Readable,
  contentType?: string,
  target?: StorageTarget,
): Promise<void> => getStorage().putObject(key, body, contentType, target);

export const getObjectStream = (
  key: string,
  range?: { start?: number; end?: number },
  target?: StorageTarget,
): Promise<Readable> => getStorage().getObjectStream(key, range, target);

export const headObject = (key: string, target?: StorageTarget): Promise<HeadObjectResult> =>
  getStorage().headObject(key, target);

export const objectExists = (key: string, target?: StorageTarget): Promise<boolean> =>
  getStorage().objectExists(key, target);

export const deleteObject = (key: string, target?: StorageTarget): Promise<void> =>
  getStorage().deleteObject(key, target);

export const deletePrefix = (prefix: string, target?: StorageTarget): Promise<number> =>
  getStorage().deletePrefix(prefix, target);

export const moveFile = (fromKey: string, toKey: string, target?: StorageTarget): Promise<void> =>
  getStorage().moveFile(fromKey, toKey, target);

export const getFileBuffer = (key: string, target?: StorageTarget): Promise<Buffer> =>
  getStorage().getFileBuffer(key, target);

export const getFileHandle = (
  key: string,
  target?: StorageTarget,
): Promise<{ path: string; cleanup: () => Promise<void> }> => getStorage().getFileHandle(key, target);

export const presignPutUrl = (options: PresignPutOptions): Promise<string> => getStorage().presignPutUrl(options);

export const presignGetUrl = (options: PresignGetOptions): Promise<string> => getStorage().presignGetUrl(options);

export const buildPublicUrl = (key: string, target?: StorageTarget): string => getStorage().buildPublicUrl(key, target);

export const configureUploadCors = (origins: string[], target?: StorageTarget): Promise<void> =>
  getStorage().configureUploadCors(origins, target);

export const putBucketCors = (rules: CorsRuleInput[], target?: StorageTarget): Promise<void> => {
  const storage = getStorage();
  if (storage instanceof S3Storage) {
    return storage.putBucketCors(rules, target);
  }
  return Promise.resolve();
};

const storage = getStorage();
export default storage;
