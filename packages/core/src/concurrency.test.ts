import { AppError } from '@nibleaf/shared';
import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { assertIfMatch, etag, parseIfMatch, requireIfMatch } from './concurrency';

function mockContext(ifMatchHeader?: string): Context {
  return {
    req: {
      header: (name: string) => {
        if (name.toLowerCase() === 'if-match') return ifMatchHeader;
      },
    },
  } as unknown as Context;
}

describe('Optimistic Concurrency Control (OCC)', () => {
  it('generates a strong quoted ETag from numbers, dates, and strings', () => {
    expect(etag(1)).toBe('"1"');
    expect(etag('rev-abc')).toBe('"rev-abc"');
    const now = new Date('2026-09-13T12:00:00.000Z');
    expect(etag(now)).toBe(`"${now.getTime()}"`);
  });

  it('parses If-Match header and strips quotes', () => {
    expect(parseIfMatch(mockContext('"12345"'))).toBe('12345');
    expect(parseIfMatch(mockContext('12345'))).toBe('12345');
    expect(parseIfMatch(mockContext(undefined))).toBeNull();
  });

  it('requireIfMatch throws 428 when header is missing', () => {
    expect(() => requireIfMatch(mockContext(undefined))).toThrowError(AppError);
    try {
      requireIfMatch(mockContext(undefined));
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('http:precondition_required');
      expect((err as AppError).status).toBe(428);
    }
  });

  it('assertIfMatch passes when client and server versions match', () => {
    const timestamp = 1_757_764_800_000;
    const ctx = mockContext(`"${timestamp}"`);
    expect(() => assertIfMatch(ctx, timestamp)).not.toThrow();
  });

  it('assertIfMatch throws 412 when versions mismatch', () => {
    const ctx = mockContext('"1000"');
    try {
      assertIfMatch(ctx, '2000');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('http:precondition_failed');
      expect((err as AppError).status).toBe(412);
    }
  });
});
