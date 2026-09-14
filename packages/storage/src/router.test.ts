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
