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
      throw new Error(`Invalid storage key (path traversal detected): "${key}"`);
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
