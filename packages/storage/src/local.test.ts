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
