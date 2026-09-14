# Storage S3 & Local Filesystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt `@nibleaf/storage` to support local filesystem storage alongside S3 using Outline's storage architecture, including HMAC-signed local presigned upload/download endpoints and backward-compatible function facades.

**Architecture:** An abstract `BaseStorage` class defines the unified storage contract. `LocalStorage` provides a secure, sandboxed Node filesystem driver with directory traversal prevention, range streaming, and empty parent pruning. `S3Storage` wraps AWS S3 client operations. A Hono `storageRouter` mounted at `/api/storage/files` handles presigned uploads and downloads for local storage. Top-level function facades preserve 100% backward compatibility for all existing consumers.

**Tech Stack:** TypeScript, Node.js (`node:fs`, `node:stream`, `node:crypto`), Hono, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, Vitest.

## Global Constraints
- Target workspace: `packages/storage` and `apps/server`.
- Zero breaking changes for existing consumers (`@nibleaf/content`, `@nibleaf/exports`, `@nibleaf/worker`, `@nibleaf/server`).
- Node 22+ / Bun runtime compatibility.
- Disallow path traversal: keys must not escape `STORAGE_LOCAL_ROOT_DIR`.
- All tests must pass: `pnpm --filter @nibleaf/storage test` and `pnpm --filter @nibleaf/storage typecheck`.

---

### Task 1: Environment Keys, Gitignore, Package Dependencies & HMAC Signatures

**Files:**
- Modify: `packages/storage/package.json`
- Modify: `.gitignore`
- Modify: `packages/storage/src/keys.ts`
- Create: `packages/storage/src/signature.ts`
- Test: `packages/storage/src/signature.test.ts`

**Interfaces:**
- Produces:
  - `keys().STORAGE_PROVIDER`: `'local' | 'maxio' | 'minio' | 's3' | 'b2'`
  - `keys().STORAGE_LOCAL_ROOT_DIR`: `string`
  - `keys().STORAGE_SIGNING_SECRET`: `string | undefined`
  - `keys().STORAGE_API_URL`: `string | undefined`
  - `createStorageSignature(action: 'put' | 'get', key: string, expires: number, secret: string): string`
  - `verifyStorageSignature(action: 'put' | 'get', key: string, expires: number, signature: string, secret: string): boolean`

- [ ] **Step 1: Write the failing tests for signature generation and verification**

Create `packages/storage/src/signature.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createStorageSignature, verifyStorageSignature } from './signature';

describe('storage signatures', () => {
  const secret = 'test-secret-12345';
  const key = 'projects/p1/assets/image.png';

  it('generates and verifies a valid signature', () => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const sig = createStorageSignature('put', key, expires, secret);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
    expect(verifyStorageSignature('put', key, expires, sig, secret)).toBe(true);
  });

  it('rejects expired signatures', () => {
    const expired = Math.floor(Date.now() / 1000) - 60;
    const sig = createStorageSignature('get', key, expired, secret);
    expect(verifyStorageSignature('get', key, expired, sig, secret)).toBe(false);
  });

  it('rejects tampered action or key', () => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const sig = createStorageSignature('put', key, expires, secret);
    expect(verifyStorageSignature('get', key, expires, sig, secret)).toBe(false);
    expect(verifyStorageSignature('put', 'other-key.png', expires, sig, secret)).toBe(false);
  });

  it('rejects invalid secret', () => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const sig = createStorageSignature('put', key, expires, secret);
    expect(verifyStorageSignature('put', key, expires, sig, 'wrong-secret')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nibleaf/storage test signature.test.ts`
Expected: FAIL (cannot find `./signature`)

- [ ] **Step 3: Update `package.json`, `.gitignore`, `keys.ts`, and implement `signature.ts`**

Update `packages/storage/package.json` to add `"hono"` to dependencies and export `./router`:
```json
  "exports": {
    ".": "./src/index.ts",
    "./keys": "./src/keys.ts",
    "./router": "./src/router.ts"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.1125.0",
    "@aws-sdk/s3-request-presigner": "^3.1125.0",
    "@nibleaf/logger": "workspace:*",
    "@t3-oss/env-core": "^0.13.11",
    "hono": "^4.13.5",
    "zod": "^4.5.4"
  }
```

Update `.gitignore`:
```gitignore
data/storage/
```

Update `packages/storage/src/keys.ts`:
```ts
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    server: {
      STORAGE_PROVIDER: z.enum(['local', 'maxio', 'minio', 's3', 'b2']).default('maxio'),
      STORAGE_LOCAL_ROOT_DIR: z.string().default('./data/storage'),
      STORAGE_SIGNING_SECRET: z.string().optional(),
      STORAGE_API_URL: z.string().optional(),
      STORAGE_ENDPOINT: z.string().optional(),
      STORAGE_PUBLIC_ENDPOINT: z.string().optional(),
      STORAGE_REGION: z.string().default('auto'),
      STORAGE_ACCESS_KEY_ID: z.string().default(''),
      STORAGE_SECRET_ACCESS_KEY: z.string().default(''),
      STORAGE_BUCKET: z.string().default('nibleaf'),
      STORAGE_FORCE_PATH_STYLE: z
        .enum(['true', 'false', '1', '0'])
        .default('true')
        .transform((v) => v === 'true' || v === '1'),
      STORAGE_PUBLIC_URL: z.string().optional(),
      CDN_URL: z.string().optional(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  });
```

Create `packages/storage/src/signature.ts`:
```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export type StorageAction = 'put' | 'get';

const buildPayload = (action: StorageAction, key: string, expires: number): string =>
  `${action}:${key}:${expires}`;

export const createStorageSignature = (
  action: StorageAction,
  key: string,
  expires: number,
  secret: string,
): string => {
  return createHmac('sha256', secret)
    .update(buildPayload(action, key, expires))
    .digest('hex');
};

export const verifyStorageSignature = (
  action: StorageAction,
  key: string,
  expires: number,
  signature: string,
  secret: string,
): boolean => {
  const now = Math.floor(Date.now() / 1000);
  if (expires < now) {
    return false;
  }
  const expected = createStorageSignature(action, key, expires, secret);
  if (expected.length !== signature.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @nibleaf/storage test signature.test.ts`
Expected: PASS (4 tests passed)

- [ ] **Step 5: Commit**

```bash
git add packages/storage/package.json .gitignore packages/storage/src/keys.ts packages/storage/src/signature.ts packages/storage/src/signature.test.ts
git commit -m "feat(storage): add local storage env keys and hmac signature verification"
```

---

### Task 2: BaseStorage Abstract Class & MIME / Content-Disposition Utilities

**Files:**
- Create: `packages/storage/src/base.ts`
- Test: `packages/storage/src/base.test.ts`

**Interfaces:**
- Produces:
  - `BaseStorage` abstract class
  - `inferContentType(filename: string): string`
  - Interfaces: `PresignPutOptions`, `PresignGetOptions`, `HeadObjectResult`, `CorsRuleInput`

- [ ] **Step 1: Write the failing tests for BaseStorage and MIME/disposition utilities**

Create `packages/storage/src/base.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BaseStorage, inferContentType } from './base';

class TestStorage extends BaseStorage {
  public putObject = async () => {};
  public getObjectStream = async () => { throw new Error('Not implemented'); };
  public headObject = async () => ({});
  public objectExists = async () => true;
  public deleteObject = async () => {};
  public deletePrefix = async () => 0;
  public moveFile = async () => {};
  public getFileHandle = async () => ({ path: '/tmp/test', cleanup: async () => {} });
  public presignPutUrl = async () => 'https://example.com/put';
  public presignGetUrl = async () => 'https://example.com/get';
  public buildPublicUrl = () => 'https://example.com/public';
  public ensureBucket = async () => {};
  public configureUploadCors = async () => {};
}

describe('BaseStorage & utilities', () => {
  const storage = new TestStorage();

  it('infers content type from filename extension', () => {
    expect(inferContentType('image.png')).toBe('image/png');
    expect(inferContentType('document.pdf')).toBe('application/pdf');
    expect(inferContentType('archive.tar.gz')).toBe('application/gzip');
    expect(inferContentType('unknown.xyz123')).toBe('application/octet-stream');
  });

  it('determines content disposition type', () => {
    expect(storage.getContentDispositionType('image/png')).toBe('inline');
    expect(storage.getContentDispositionType('application/pdf')).toBe('inline');
    expect(storage.getContentDispositionType('application/zip')).toBe('attachment');
    expect(storage.getContentDispositionType(undefined)).toBe('attachment');
  });

  it('builds standard Content-Disposition header value', () => {
    expect(storage.getContentDisposition('image/png', 'photo.png')).toBe('inline; filename="photo.png"');
    expect(storage.getContentDisposition('application/zip', 'archive.zip')).toBe('attachment; filename="archive.zip"');
    expect(storage.getContentDisposition('image/jpeg')).toBe('inline');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nibleaf/storage test base.test.ts`
Expected: FAIL (cannot find `./base`)

- [ ] **Step 3: Implement `packages/storage/src/base.ts`**

Create `packages/storage/src/base.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @nibleaf/storage test base.test.ts`
Expected: PASS (3 tests passed)

- [ ] **Step 5: Commit**

```bash
git add packages/storage/src/base.ts packages/storage/src/base.test.ts
git commit -m "feat(storage): add BaseStorage abstract class and content disposition utilities"
```

---

### Task 3: LocalStorage Implementation & Path Traversal Security

**Files:**
- Create: `packages/storage/src/local.ts`
- Test: `packages/storage/src/local.test.ts`

**Interfaces:**
- Consumes:
  - `BaseStorage`, `inferContentType` from `./base`
  - `createStorageSignature` from `./signature`
  - `keys` from `./keys`
- Produces:
  - `LocalStorage` class extending `BaseStorage`

- [ ] **Step 1: Write the failing tests for LocalStorage**

Create `packages/storage/src/local.test.ts`:
```ts
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalStorage } from './local';

describe('LocalStorage driver', () => {
  let tempDir: string;
  let storage: LocalStorage;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nibleaf-storage-test-'));
    storage = new LocalStorage({
      rootDir: tempDir,
      signingSecret: 'test-secret',
      apiUrl: 'http://localhost:4311',
    });
    await storage.ensureBucket();
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('persists and reads buffer objects', async () => {
    const key = 'test/dir/sample.txt';
    await storage.putObject(key, 'Hello, Nibleaf!');
    expect(await storage.objectExists(key)).toBe(true);

    const buf = await storage.getFileBuffer(key);
    expect(buf.toString()).toBe('Hello, Nibleaf!');

    const head = await storage.headObject(key);
    expect(head.ContentLength).toBe(15);
    expect(head.ContentType).toBe('text/plain');
  });

  it('supports stream range requests', async () => {
    const key = 'test/range.txt';
    await storage.putObject(key, '0123456789');

    const stream = await storage.getObjectStream(key, { start: 2, end: 5 });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe('2345');
  });

  it('moves files across locations', async () => {
    const src = 'source/file.txt';
    const dest = 'target/moved.txt';
    await storage.putObject(src, 'content to move');
    await storage.moveFile(src, dest);

    expect(await storage.objectExists(src)).toBe(false);
    expect(await storage.objectExists(dest)).toBe(true);
  });

  it('deletes objects and prunes empty parent directories', async () => {
    const key = 'nested/a/b/file.txt';
    await storage.putObject(key, 'delete me');
    expect(await storage.objectExists(key)).toBe(true);

    await storage.deleteObject(key);
    expect(await storage.objectExists(key)).toBe(false);

    // Empty nested directory should be pruned
    const dirExists = await fs.access(path.join(tempDir, 'nested/a/b')).then(() => true).catch(() => false);
    expect(dirExists).toBe(false);
  });

  it('recursively deletes prefixes', async () => {
    await storage.putObject('bulk/file1.txt', '1');
    await storage.putObject('bulk/file2.txt', '2');
    await storage.putObject('bulk/sub/file3.txt', '3');

    const deleted = await storage.deletePrefix('bulk/');
    expect(deleted).toBe(3);
    expect(await storage.objectExists('bulk/file1.txt')).toBe(false);
  });

  it('strictly blocks path traversal attempts', async () => {
    expect(() => storage.resolvePath('../escape.txt')).toThrow(/path traversal/i);
    expect(() => storage.resolvePath('a/../../escape.txt')).toThrow(/Invalid storage key/i);
    expect(() => storage.resolvePath('a/\0/nullbyte')).toThrow(/Invalid storage key/i);
  });

  it('returns valid file handles with no-op cleanup', async () => {
    const key = 'handle/file.txt';
    await storage.putObject(key, 'handle data');
    const handle = await storage.getFileHandle(key);
    expect(handle.path).toBe(storage.resolvePath(key));
    await expect(handle.cleanup()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nibleaf/storage test local.test.ts`
Expected: FAIL (cannot find `./local`)

- [ ] **Step 3: Implement `packages/storage/src/local.ts`**

Create `packages/storage/src/local.ts`:
```ts
import { createReadStream, createWriteStream, existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { BaseStorage, type HeadObjectResult, inferContentType, type PresignGetOptions, type PresignPutOptions } from './base';
import type { StorageTarget } from './client';
import { keys } from './keys';
import { createStorageSignature } from './signature';

const DEFAULT_EXPIRES_IN_SECONDS = 3600;

export interface LocalStorageOptions {
  apiUrl?: string;
  rootDir?: string;
  signingSecret?: string;
}

const resolveStorageRoot = (configuredDir: string): string => {
  if (path.isAbsolute(configuredDir)) {
    return path.resolve(configuredDir);
  }
  let current = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return path.resolve(current, configuredDir);
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(process.cwd(), configuredDir);
};

export class LocalStorage extends BaseStorage {
  private rootDir: string;
  private signingSecret: string;
  private apiUrl: string;

  constructor(options?: LocalStorageOptions) {
    super();
    const env = keys();
    this.rootDir = options?.rootDir ? path.resolve(options.rootDir) : resolveStorageRoot(env.STORAGE_LOCAL_ROOT_DIR);
    this.signingSecret = options?.signingSecret ?? env.STORAGE_SIGNING_SECRET ?? process.env.BETTER_AUTH_SECRET ?? 'nibleaf-local-secret';
    this.apiUrl = options?.apiUrl ?? env.STORAGE_API_URL ?? process.env.API_URL ?? 'http://localhost:4311';
  }

  public resolvePath(key: string): string {
    if (!key || key.includes('\0') || key.split(/[\\/]/).includes('..')) {
      throw new Error(`Invalid storage key: "${key}"`);
    }
    const cleanKey = key.replace(/^[\\/]+/, '');
    const resolved = path.resolve(this.rootDir, cleanKey);
    if (!resolved.startsWith(this.rootDir)) {
      throw new Error(`Invalid storage key (path traversal detected): "${key}"`);
    }
    return resolved;
  }

  public async putObject(
    key: string,
    body: Buffer | Uint8Array | string | Readable,
    _contentType?: string,
    _target?: StorageTarget,
  ): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    if (body instanceof Readable) {
      await pipeline(body, createWriteStream(filePath));
    } else {
      await fs.writeFile(filePath, body);
    }
  }

  public async getObjectStream(
    key: string,
    range?: { start?: number; end?: number },
    _target?: StorageTarget,
  ): Promise<Readable> {
    const filePath = this.resolvePath(key);
    if (!existsSync(filePath)) {
      throw new Error(`Object not found: "${key}"`);
    }
    return createReadStream(filePath, range);
  }

  public async headObject(key: string, _target?: StorageTarget): Promise<HeadObjectResult> {
    const filePath = this.resolvePath(key);
    try {
      const stat = await fs.stat(filePath);
      return {
        ContentLength: stat.size,
        ContentType: inferContentType(key),
        LastModified: stat.mtime,
      };
    } catch {
      throw new Error(`Object not found: "${key}"`);
    }
  }

  public async objectExists(key: string, _target?: StorageTarget): Promise<boolean> {
    try {
      const filePath = this.resolvePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  public async deleteObject(key: string, _target?: StorageTarget): Promise<void> {
    const filePath = this.resolvePath(key);
    try {
      await fs.unlink(filePath);
      await this.pruneEmptyDirectories(path.dirname(filePath));
    } catch (error) {
      if ((error as { code?: string })?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  public async deletePrefix(prefix: string, _target?: StorageTarget): Promise<number> {
    const cleanPrefix = prefix.replace(/^[\\/]+/, '');
    const targetDir = path.resolve(this.rootDir, cleanPrefix);
    if (!targetDir.startsWith(this.rootDir) || !existsSync(targetDir)) {
      return this.deletePrefixByWalk(cleanPrefix);
    }
    const stat = await fs.stat(targetDir);
    if (stat.isDirectory()) {
      const count = await this.countFiles(targetDir);
      await fs.rm(targetDir, { recursive: true, force: true });
      await this.pruneEmptyDirectories(path.dirname(targetDir));
      return count;
    }
    return this.deletePrefixByWalk(cleanPrefix);
  }

  private async deletePrefixByWalk(prefix: string): Promise<number> {
    let deleted = 0;
    const walk = async (currentDir: string) => {
      if (!existsSync(currentDir)) return;
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(currentDir, entry.name);
        const rel = path.relative(this.rootDir, full).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          await walk(full);
        } else if (rel.startsWith(prefix)) {
          await fs.unlink(full);
          deleted += 1;
        }
      }
    };
    await walk(this.rootDir);
    return deleted;
  }

  private async countFiles(dir: string): Promise<number> {
    let count = 0;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        count += await this.countFiles(path.join(dir, entry.name));
      } else {
        count += 1;
      }
    }
    return count;
  }

  private async pruneEmptyDirectories(directory: string): Promise<void> {
    let current = directory;
    while (current.startsWith(this.rootDir) && current !== this.rootDir) {
      try {
        const files = await fs.readdir(current);
        if (files.length === 0) {
          await fs.rmdir(current);
          current = path.dirname(current);
        } else {
          break;
        }
      } catch {
        break;
      }
    }
  }

  public async moveFile(fromKey: string, toKey: string, _target?: StorageTarget): Promise<void> {
    const src = this.resolvePath(fromKey);
    const dest = this.resolvePath(toKey);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fs.rename(src, dest);
    } catch (err) {
      if ((err as { code?: string })?.code === 'EXDEV') {
        await pipeline(createReadStream(src), createWriteStream(dest));
        await fs.unlink(src);
      } else {
        throw err;
      }
    }
    await this.pruneEmptyDirectories(path.dirname(src));
  }

  public async getFileHandle(key: string, _target?: StorageTarget): Promise<{ path: string; cleanup: () => Promise<void> }> {
    const filePath = this.resolvePath(key);
    return {
      path: filePath,
      cleanup: async () => {},
    };
  }

  public async presignPutUrl({ key, expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS }: PresignPutOptions): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const sig = createStorageSignature('put', key, expires, this.signingSecret);
    const base = this.apiUrl.replace(/\/+$/, '');
    return `${base}/api/storage/files?action=put&key=${encodeURIComponent(key)}&expires=${expires}&sig=${sig}`;
  }

  public async presignGetUrl({ key, expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS }: PresignGetOptions): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const sig = createStorageSignature('get', key, expires, this.signingSecret);
    const base = this.apiUrl.replace(/\/+$/, '');
    return `${base}/api/storage/files?action=get&key=${encodeURIComponent(key)}&expires=${expires}&sig=${sig}`;
  }

  public buildPublicUrl(key: string, _target?: StorageTarget): string {
    const base = this.apiUrl.replace(/\/+$/, '');
    const cleanKey = key.replace(/^[\\/]+/, '');
    return `${base}/api/public/assets/${cleanKey}`;
  }

  public async ensureBucket(_target?: StorageTarget): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true });
  }

  public async configureUploadCors(_origins: string[], _target?: StorageTarget): Promise<void> {
    // Local filesystem server handles CORS directly via HTTP server headers.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @nibleaf/storage test local.test.ts`
Expected: PASS (7 tests passed)

- [ ] **Step 5: Commit**

```bash
git add packages/storage/src/local.ts packages/storage/src/local.test.ts
git commit -m "feat(storage): implement LocalStorage with path traversal protection"
```

---

### Task 4: S3Storage Class Implementation

**Files:**
- Create: `packages/storage/src/s3.ts`
- Test: `packages/storage/src/s3.test.ts`

**Interfaces:**
- Consumes:
  - `BaseStorage`, `HeadObjectResult`, `CorsRuleInput` from `./base`
  - `getBucket`, `getPublicBaseUrl`, `getS3Client`, `publicTarget`, `StorageTarget` from `./client`
- Produces:
  - `S3Storage` class extending `BaseStorage`

- [ ] **Step 1: Write the failing tests for S3Storage**

Create `packages/storage/src/s3.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { S3Storage } from './s3';

describe('S3Storage class', () => {
  it('instantiates cleanly and generates public URLs', () => {
    const s3 = new S3Storage();
    expect(s3).toBeInstanceOf(S3Storage);
    // buildPublicUrl trims extra slashes
    const url = s3.buildPublicUrl('images/avatar.png', {
      endpoint: 'http://localhost:9000',
      region: 'auto',
      forcePathStyle: true,
      accessKeyId: 'test',
      secretAccessKey: 'test',
      bucket: 'nibleaf',
      publicUrl: 'https://cdn.example.com/',
    });
    expect(url).toBe('https://cdn.example.com/images/avatar.png');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nibleaf/storage test s3.test.ts`
Expected: FAIL (cannot find `./s3`)

- [ ] **Step 3: Implement `packages/storage/src/s3.ts`**

Create `packages/storage/src/s3.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @nibleaf/storage test s3.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/storage/src/s3.ts packages/storage/src/s3.test.ts
git commit -m "feat(storage): implement S3Storage class extending BaseStorage"
```

---

### Task 5: Storage Router Implementation for Local Presigned PUT/GET

**Files:**
- Create: `packages/storage/src/router.ts`
- Test: `packages/storage/src/router.test.ts`

**Interfaces:**
- Consumes:
  - `BaseStorage` from `./base`
  - `createStorageSignature`, `verifyStorageSignature` from `./signature`
- Produces:
  - `createStorageRouter(storageInstance?: BaseStorage, signingSecret?: string): Hono`
  - `storageRouter: Hono`

- [ ] **Step 1: Write the failing tests for storageRouter**

Create `packages/storage/src/router.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BaseStorage } from './base';
import { createStorageRouter } from './router';
import { createStorageSignature } from './signature';

class MockStorage extends BaseStorage {
  public files = new Map<string, Buffer>();
  public putObject = async (key: string, body: Buffer | Uint8Array | string) => {
    this.files.set(key, Buffer.from(body));
  };
  public getObjectStream = async (key: string) => {
    const buf = this.files.get(key);
    if (!buf) throw new Error('Not found');
    const { Readable } = await import('node:stream');
    return Readable.from(buf);
  };
  public headObject = async (key: string) => {
    const buf = this.files.get(key);
    if (!buf) throw new Error('Not found');
    return { ContentLength: buf.length, ContentType: 'text/plain' };
  };
  public objectExists = async (key: string) => this.files.has(key);
  public deleteObject = async (key: string) => { this.files.delete(key); };
  public deletePrefix = async () => 0;
  public moveFile = async () => {};
  public getFileHandle = async () => ({ path: '', cleanup: async () => {} });
  public presignPutUrl = async () => '';
  public presignGetUrl = async () => '';
  public buildPublicUrl = () => '';
  public ensureBucket = async () => {};
  public configureUploadCors = async () => {};
}

describe('storageRouter', () => {
  const secret = 'router-test-secret';
  const mockStorage = new MockStorage();
  const app = createStorageRouter(mockStorage, secret);

  it('accepts valid PUT upload request', async () => {
    const key = 'test/upload.txt';
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const sig = createStorageSignature('put', key, expires, secret);

    const res = await app.request(`/?action=put&key=${encodeURIComponent(key)}&expires=${expires}&sig=${sig}`, {
      method: 'PUT',
      body: 'Hello uploaded content',
      headers: { 'Content-Type': 'text/plain' },
    });

    expect(res.status).toBe(200);
    expect(mockStorage.files.get(key)?.toString()).toBe('Hello uploaded content');
  });

  it('rejects PUT upload with invalid signature', async () => {
    const key = 'test/bad.txt';
    const expires = Math.floor(Date.now() / 1000) + 3600;

    const res = await app.request(`/?action=put&key=${encodeURIComponent(key)}&expires=${expires}&sig=invalid_sig`, {
      method: 'PUT',
      body: 'bad',
    });

    expect(res.status).toBe(403);
  });

  it('serves GET download with proper headers', async () => {
    const key = 'test/download.txt';
    mockStorage.files.set(key, Buffer.from('Downloaded content'));
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const sig = createStorageSignature('get', key, expires, secret);

    const res = await app.request(`/?action=get&key=${encodeURIComponent(key)}&expires=${expires}&sig=${sig}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain');
    expect(await res.text()).toBe('Downloaded content');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nibleaf/storage test router.test.ts`
Expected: FAIL (cannot find `./router`)

- [ ] **Step 3: Implement `packages/storage/src/router.ts`**

Create `packages/storage/src/router.ts`:
```ts
import { Readable } from 'node:stream';
import { Hono } from 'hono';
import { BaseStorage } from './base';
import { keys } from './keys';
import { verifyStorageSignature } from './signature';

const pathBasename = (filePath: string): string => {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || 'download';
};

export const createStorageRouter = (storageInstance?: BaseStorage, signingSecret?: string) => {
  const router = new Hono();

  const getSecret = () =>
    signingSecret ?? keys().STORAGE_SIGNING_SECRET ?? process.env.BETTER_AUTH_SECRET ?? 'nibleaf-local-secret';

  router.put('/', async (ctx) => {
    const action = ctx.req.query('action');
    const key = ctx.req.query('key');
    const expiresStr = ctx.req.query('expires');
    const sig = ctx.req.query('sig');

    if (action !== 'put' || !key || !expiresStr || !sig) {
      return ctx.text('Missing required query parameters', 400);
    }

    const expires = parseInt(expiresStr, 10);
    if (Number.isNaN(expires)) {
      return ctx.text('Invalid expiration timestamp', 400);
    }

    if (!verifyStorageSignature('put', key, expires, sig, getSecret())) {
      return ctx.text('Forbidden: invalid or expired signature', 403);
    }

    const storage = storageInstance ?? (await import('./index')).default;
    const contentType = ctx.req.header('content-type') || undefined;

    const arrayBuffer = await ctx.req.arrayBuffer();
    await storage.putObject(key, Buffer.from(arrayBuffer), contentType);

    return ctx.text('OK', 200);
  });

  router.get('/', async (ctx) => {
    const action = ctx.req.query('action');
    const key = ctx.req.query('key');
    const expiresStr = ctx.req.query('expires');
    const sig = ctx.req.query('sig');

    if (action !== 'get' || !key || !expiresStr || !sig) {
      return ctx.text('Missing required query parameters', 400);
    }

    const expires = parseInt(expiresStr, 10);
    if (Number.isNaN(expires)) {
      return ctx.text('Invalid expiration timestamp', 400);
    }

    if (!verifyStorageSignature('get', key, expires, sig, getSecret())) {
      return ctx.text('Forbidden: invalid or expired signature', 403);
    }

    const storage = storageInstance ?? (await import('./index')).default;
    try {
      const head = await storage.headObject(key);
      const stream = await storage.getObjectStream(key);

      const headers: Record<string, string> = {
        'Content-Type': head.ContentType ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      };
      if (typeof head.ContentLength === 'number') {
        headers['Content-Length'] = String(head.ContentLength);
      }
      const filename = pathBasename(key);
      headers['Content-Disposition'] = storage.getContentDisposition(head.ContentType, filename);

      for (const [k, v] of Object.entries(headers)) {
        ctx.header(k, v);
      }

      return ctx.body(Readable.toWeb(stream) as ReadableStream);
    } catch {
      return ctx.text('Not found', 404);
    }
  });

  return router;
};

export const storageRouter = createStorageRouter();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @nibleaf/storage test router.test.ts`
Expected: PASS (3 tests passed)

- [ ] **Step 5: Commit**

```bash
git add packages/storage/src/router.ts packages/storage/src/router.test.ts
git commit -m "feat(storage): add local presigned storageRouter and tests"
```

---

### Task 6: Unified Facade, Re-exports & Singleton Factory

**Files:**
- Modify: `packages/storage/src/index.ts`

**Interfaces:**
- Produces:
  - `getStorage(): BaseStorage`
  - Re-exports of `BaseStorage`, `LocalStorage`, `S3Storage`, `storageRouter`, `createStorageRouter`
  - Backward-compatible function facades: `putObject`, `getObjectStream`, `headObject`, `objectExists`, `deleteObject`, `deletePrefix`, `moveFile`, `getFileBuffer`, `getFileHandle`, `presignPutUrl`, `presignGetUrl`, `buildPublicUrl`, `ensureBucket`, `configureUploadCors`, `putBucketCors`
  - Default export `storage`

- [ ] **Step 1: Rewrite `packages/storage/src/index.ts` to implement singleton and facades**

Update `packages/storage/src/index.ts`:
```ts
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
```

- [ ] **Step 2: Run all `@nibleaf/storage` tests and typecheck**

Run: `pnpm --filter @nibleaf/storage test`
Expected: PASS (all test files pass)

Run: `pnpm --filter @nibleaf/storage typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/storage/src/index.ts
git commit -m "feat(storage): export unified getStorage factory and backward-compatible facades"
```

---

### Task 7: Mount Storage Router in Server

**Files:**
- Modify: `apps/server/src/create-app.ts`

**Interfaces:**
- Consumes:
  - `storageRouter` from `@nibleaf/storage`

- [ ] **Step 1: Mount `storageRouter` on `apiApp` in `create-app.ts`**

Import `storageRouter`:
```ts
import { storageRouter } from '@nibleaf/storage';
```
In `createApp()` where `apiApp` routes are configured:
```ts
    .on(['POST', 'GET'], '/auth/*', (ctx) => auth.handler(ctx.req.raw))
    .route('/mcp', mcp)
    .route('/storage/files', storageRouter)
    .route('/', modulesRouter);
```

- [ ] **Step 2: Run server typecheck and test**

Run: `pnpm --filter @nibleaf/server typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/create-app.ts
git commit -m "feat(server): mount storageRouter for local presigned file uploads and downloads"
```

---

### Task 8: Full Monorepo Validation & End-to-End Verification

**Files:**
- Workspace-wide verification

- [ ] **Step 1: Run full workspace typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 2: Run all unit tests**

Run: `pnpm --filter @nibleaf/storage test`
Expected: PASS

- [ ] **Step 3: Run server tests**

Run: `pnpm --filter @nibleaf/server test`
Expected: PASS

- [ ] **Step 4: Commit any final adjustments**

```bash
git status
```
