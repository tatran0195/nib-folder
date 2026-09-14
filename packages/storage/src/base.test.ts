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
