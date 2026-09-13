import { Prisma } from '@nibleaf/database';
import { AppError } from '@nibleaf/shared';

/**
 * Translates low-level Prisma database exceptions into domain AppError instances.
 * Inspired by Avkash's mapDatabaseError pattern.
 */
export function mapPrismaError(error: unknown): AppError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // P2002: Unique constraint failed
      case 'P2002': {
        const target = Array.isArray(error.meta?.target) ? (error.meta.target as string[]).join(', ') : 'field';
        return new AppError({
          code: 'database:conflict',
          message: `A record with this ${target} already exists.`,
          details: { target: error.meta?.target },
        });
      }
      // P2025: Record to update/delete not found
      case 'P2025': {
        return new AppError({
          code: 'database:not_found',
          message: typeof error.meta?.cause === 'string' ? error.meta.cause : 'Record not found.',
          details: error.meta,
        });
      }
      // P2003: Foreign key constraint failed
      case 'P2003': {
        const field = typeof error.meta?.field_name === 'string' ? error.meta.field_name : 'relation';
        return new AppError({
          code: 'http:bad_request',
          message: `Referenced ${field} does not exist.`,
          details: error.meta,
        });
      }
      // P2000: Value too long for column
      case 'P2000': {
        const column = typeof error.meta?.column_name === 'string' ? error.meta.column_name : 'field';
        return new AppError({
          code: 'validation:failed',
          message: `Provided value for ${column} exceeds maximum length.`,
          details: error.meta,
        });
      }
      // P2011: Null constraint violation
      case 'P2011': {
        const constraint = typeof error.meta?.constraint === 'string' ? error.meta.constraint : 'field';
        return new AppError({
          code: 'validation:failed',
          message: `Missing required value for ${constraint}.`,
          details: error.meta,
        });
      }
      // P2014: Required relation violation
      case 'P2014': {
        return new AppError({
          code: 'http:bad_request',
          message: 'The requested change would violate a required relation.',
          details: error.meta,
        });
      }
      default:
        break;
    }
  }

  return null;
}
