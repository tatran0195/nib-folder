import { AppError } from '@nibleaf/shared';
import type { Context } from 'hono';

/**
 * Generates a strong ETag validator header for a resource version or timestamp.
 * Inspired by Avkash's optimistic concurrency pattern.
 */
export function etag(version: number | string | Date): string {
  const value = version instanceof Date ? version.getTime() : version;
  return `"${value}"`;
}

/**
 * Extracts and cleans the `If-Match` header from the request.
 */
export function parseIfMatch(c: Context): string | null {
  const header = c.req.header('if-match');
  if (!header) return null;
  return header.replace(/"/g, '').trim();
}

/**
 * Requires an `If-Match` header on mutating requests (CAS guard).
 * Throws 428 Precondition Required if missing.
 */
export function requireIfMatch(c: Context): string {
  const match = parseIfMatch(c);
  if (!match) {
    throw new AppError({
      code: 'http:precondition_required',
      message: 'An If-Match header with the resource version or ETag is required for this mutation.',
    });
  }
  return match;
}

/**
 * Asserts that the client's `If-Match` header matches the resource's current version or timestamp.
 * Throws 412 Precondition Failed if stale.
 */
export function assertIfMatch(c: Context, currentVersion: number | string | Date): void {
  const clientVersion = requireIfMatch(c);
  const serverVersion = String(currentVersion instanceof Date ? currentVersion.getTime() : currentVersion);

  if (clientVersion !== serverVersion) {
    throw new AppError({
      code: 'http:precondition_failed',
      message: 'The resource has been modified concurrently. Please refresh and try again.',
      details: { expected: clientVersion, current: serverVersion },
    });
  }
}
