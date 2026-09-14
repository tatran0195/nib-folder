import { createWriteStream, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  ListObjectsV2Command,
  type ObjectIdentifier,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '@nibleaf/logger';
import { BaseStorage, type CorsRuleInput, type HeadObjectResult, type PresignGetOptions, type PresignPutOptions } from './base';
import { getBucket, getPublicBaseUrl, getS3Client, publicTarget, type StorageTarget } from './client';

const DELETE_BATCH_SIZE = 1000;
const DEFAULT_EXPIRES_IN_SECONDS = 3600;

export class S3Storage extends BaseStorage {
  public async ensureBucket(target?: StorageTarget): Promise<void> {
    const client = getS3Client(target);
    const bucket = getBucket(target);
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        logger.info({ bucket }, 'created storage bucket');
      } catch (error) {
        if ((error as { code?: string })?.code === 'ECONNREFUSED') {
          logger.debug({ bucket }, 'storage endpoint unreachable; skipping bucket creation');
        } else {
          logger.warn({ error, bucket }, 'could not ensure storage bucket (may already exist or be managed externally)');
        }
      }
    }
  }

  public async putObject(
    key: string,
    body: Buffer | Uint8Array | string | Readable,
    contentType?: string,
    target?: StorageTarget,
  ): Promise<void> {
    await getS3Client(target).send(
      new PutObjectCommand({
        Bucket: getBucket(target),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  public async getObjectStream(
    key: string,
    range?: { start?: number; end?: number },
    target?: StorageTarget,
  ): Promise<Readable> {
    const rangeHeader = range && typeof range.start === 'number' && typeof range.end === 'number'
      ? `bytes=${range.start}-${range.end}`
      : undefined;

    const result = await getS3Client(target).send(
      new GetObjectCommand({
        Bucket: getBucket(target),
        Key: key,
        Range: rangeHeader,
      }),
    );
    const body = result.Body;
    if (!(body instanceof Readable)) {
      throw new Error(`Object body for "${key}" is not a readable stream`);
    }
    return body;
  }

  public async headObject(key: string, target?: StorageTarget): Promise<HeadObjectResult> {
    const res: HeadObjectCommandOutput = await getS3Client(target).send(
      new HeadObjectCommand({ Bucket: getBucket(target), Key: key }),
    );
    return {
      ContentLength: res.ContentLength,
      ContentType: res.ContentType,
      LastModified: res.LastModified,
      ETag: res.ETag,
    };
  }

  public async objectExists(key: string, target?: StorageTarget): Promise<boolean> {
    try {
      await this.headObject(key, target);
      return true;
    } catch (error) {
      if (this.isNotFound(error)) {
        return false;
      }
      throw error;
    }
  }

  public async deleteObject(key: string, target?: StorageTarget): Promise<void> {
    await getS3Client(target).send(new DeleteObjectCommand({ Bucket: getBucket(target), Key: key }));
  }

  public async deletePrefix(prefix: string, target?: StorageTarget): Promise<number> {
    const client = getS3Client(target);
    const bucket = getBucket(target);
    let continuationToken: string | undefined;
    let deleted = 0;
    do {
      const listed = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }),
      );
      const identifiers: ObjectIdentifier[] = (listed.Contents ?? []).flatMap((object) =>
        object.Key ? [{ Key: object.Key }] : [],
      );
      for (let i = 0; i < identifiers.length; i += DELETE_BATCH_SIZE) {
        const batch = identifiers.slice(i, i + DELETE_BATCH_SIZE);
        await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch, Quiet: true } }));
        deleted += batch.length;
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
    return deleted;
  }

  public async moveFile(fromKey: string, toKey: string, target?: StorageTarget): Promise<void> {
    const client = getS3Client(target);
    const bucket = getBucket(target);
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: encodeURIComponent(`${bucket}/${fromKey}`),
        Key: toKey,
      }),
    );
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: fromKey }));
  }

  public async getFileHandle(
    key: string,
    target?: StorageTarget,
  ): Promise<{ path: string; cleanup: () => Promise<void> }> {
    const stream = await this.getObjectStream(key, undefined, target);
    const tempFile = path.join(os.tmpdir(), `s3-handle-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await pipeline(stream, createWriteStream(tempFile));
    return {
      path: tempFile,
      cleanup: async () => {
        await fs.unlink(tempFile).catch(() => {});
      },
    };
  }

  public presignPutUrl({
    key,
    contentType,
    expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS,
    target,
  }: PresignPutOptions): Promise<string> {
    const signTarget = target ?? publicTarget();
    return getSignedUrl(
      getS3Client(signTarget),
      new PutObjectCommand({ Bucket: getBucket(signTarget), Key: key, ContentType: contentType }),
      { expiresIn: expiresInSeconds },
    );
  }

  public presignGetUrl({
    key,
    expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS,
    target,
  }: PresignGetOptions): Promise<string> {
    const signTarget = target ?? publicTarget();
    return getSignedUrl(
      getS3Client(signTarget),
      new GetObjectCommand({ Bucket: getBucket(signTarget), Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  public buildPublicUrl(key: string, target?: StorageTarget): string {
    const base = getPublicBaseUrl(target);
    if (!base) {
      throw new Error('No public base URL configured (set STORAGE_PUBLIC_URL or CDN_URL)');
    }
    const cleanBase = base.replace(/\/+$/, '');
    const cleanKey = key.replace(/^[\\/]+/, '');
    return `${cleanBase}/${cleanKey}`;
  }

  public async configureUploadCors(origins: string[], target?: StorageTarget): Promise<void> {
    await this.putBucketCors(
      [
        {
          allowedOrigins: origins,
          allowedMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
          allowedHeaders: ['*'],
          exposeHeaders: ['ETag', 'Location'],
          maxAgeSeconds: 3600,
        },
      ],
      target,
    );
  }

  public async putBucketCors(rules: CorsRuleInput[], target?: StorageTarget): Promise<void> {
    await getS3Client(target).send(
      new PutBucketCorsCommand({
        Bucket: getBucket(target),
        CORSConfiguration: {
          CORSRules: rules.map((rule) => ({
            AllowedHeaders: rule.allowedHeaders ?? ['*'],
            AllowedMethods: rule.allowedMethods,
            AllowedOrigins: rule.allowedOrigins,
            ExposeHeaders: rule.exposeHeaders ?? [],
            MaxAgeSeconds: rule.maxAgeSeconds,
          })),
        },
      }),
    );
  }

  private isNotFound(error: unknown): boolean {
    if (!(error instanceof S3ServiceException)) return false;
    return error.name === 'NotFound' || error.name === 'NoSuchKey' || error.$metadata.httpStatusCode === 404;
  }
}
