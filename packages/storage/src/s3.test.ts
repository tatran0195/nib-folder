import { describe, expect, it } from 'vitest';
import { S3Storage } from './s3';

describe('S3Storage class', () => {
  it('instantiates cleanly and generates public URLs', () => {
    const s3 = new S3Storage();
    expect(s3).toBeInstanceOf(S3Storage);
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
