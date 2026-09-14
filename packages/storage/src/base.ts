import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import type { StorageTarget } from './client';

export interface PresignPutOptions {
  contentType?: string;
  expiresInSeconds?: number;
  key: string;
  target?: StorageTarget;
}

export interface PresignGetOptions {
  expiresInSeconds?: number;
  key: string;
  target?: StorageTarget;
}

export interface HeadObjectResult {
  ContentLength?: number;
  ContentType?: string;
  LastModified?: Date;
  [key: string]: unknown;
}

export interface CorsRuleInput {
  allowedHeaders?: string[];
  allowedMethods: string[];
  allowedOrigins: string[];
  exposeHeaders?: string[];
  maxAgeSeconds?: number;
}

const EXT_TO_MIME: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  pdf: 'application/pdf',
  json: 'application/json',
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html',
  xml: 'application/xml',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

export const inferContentType = (filename: string): string => {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return 'application/octet-stream';
  const ext = filename.slice(dot + 1).toLowerCase();
  return EXT_TO_MIME[ext] ?? 'application/octet-stream';
};

const SAFE_INLINE_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export abstract class BaseStorage {
  public abstract putObject(
    key: string,
    body: Buffer | Uint8Array | string | Readable,
    contentType?: string,
    target?: StorageTarget,
  ): Promise<void>;

  public abstract getObjectStream(
    key: string,
    range?: { start?: number; end?: number },
    target?: StorageTarget,
  ): Promise<Readable>;

  public abstract headObject(key: string, target?: StorageTarget): Promise<HeadObjectResult>;

  public abstract objectExists(key: string, target?: StorageTarget): Promise<boolean>;

  public abstract deleteObject(key: string, target?: StorageTarget): Promise<void>;

  public abstract deletePrefix(prefix: string, target?: StorageTarget): Promise<number>;

  public abstract moveFile(fromKey: string, toKey: string, target?: StorageTarget): Promise<void>;

  public async getFileBuffer(key: string, target?: StorageTarget): Promise<Buffer> {
    const stream = await this.getObjectStream(key, undefined, target);
    return buffer(stream);
  }

  public abstract getFileHandle(key: string, target?: StorageTarget): Promise<{
    path: string;
    cleanup: () => Promise<void>;
  }>;

  public abstract presignPutUrl(options: PresignPutOptions): Promise<string>;

  public abstract presignGetUrl(options: PresignGetOptions): Promise<string>;

  public abstract buildPublicUrl(key: string, target?: StorageTarget): string;

  public abstract ensureBucket(target?: StorageTarget): Promise<void>;

  public abstract configureUploadCors(origins: string[], target?: StorageTarget): Promise<void>;

  public getContentDispositionType(contentType?: string): 'inline' | 'attachment' {
    if (contentType && SAFE_INLINE_CONTENT_TYPES.has(contentType)) {
      return 'inline';
    }
    return 'attachment';
  }

  public getContentDisposition(contentType?: string, fileName?: string): string {
    const type = this.getContentDispositionType(contentType);
    if (!fileName) {
      return type;
    }
    const cleanFileName = fileName.replace(/[^\x20-\x7e]/g, '?');
    return `${type}; filename="${cleanFileName}"`;
  }
}
