import { Prisma } from '@nibleaf/database';
import { AppError } from '@/errors';

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
      default:
        break;
    }
  }

  return null;
}
