import { Prisma } from '@nibleaf/database';
import { AppError } from '@nibleaf/shared';
import { describe, expect, it } from 'vitest';
import { mapPrismaError } from './error-mapper';

describe('Prisma Error Mapper', () => {
  it('maps P2002 unique constraint to database:conflict (409)', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.0.0',
      meta: { target: ['slug'] },
    });

    const mapped = mapPrismaError(error);
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped?.code).toBe('database:conflict');
    expect(mapped?.status).toBe(409);
  });

  it('maps P2025 record not found to database:not_found (404)', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'An operation failed because it depends on one or more records that were required but not found.',
      {
        code: 'P2025',
        clientVersion: '6.0.0',
        meta: { cause: 'Project not found' },
      },
    );

    const mapped = mapPrismaError(error);
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped?.code).toBe('database:not_found');
    expect(mapped?.status).toBe(404);
  });

  it('maps P2003 foreign key constraint to http:bad_request (400)', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
      code: 'P2003',
      clientVersion: '6.0.0',
      meta: { field_name: 'organizationId' },
    });

    const mapped = mapPrismaError(error);
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped?.code).toBe('http:bad_request');
    expect(mapped?.status).toBe(400);
  });

  it('maps P2000 value too long to validation:failed (422)', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Value too long', {
      code: 'P2000',
      clientVersion: '6.0.0',
      meta: { column_name: 'title' },
    });

    const mapped = mapPrismaError(error);
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped?.code).toBe('validation:failed');
    expect(mapped?.status).toBe(422);
  });

  it('returns null for non-Prisma errors', () => {
    const standardError = new Error('Some random error');
    expect(mapPrismaError(standardError)).toBeNull();
  });
});
