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
