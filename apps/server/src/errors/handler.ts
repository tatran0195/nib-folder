import { logger } from '@nibleaf/logger';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError } from './index';
import { mapPrismaError } from '@/core/error-mapper';

interface ErrorMiddlewareOptions {
  isDevelopment: boolean;
}

const codeForStatus = (status: number) => {
  switch (status) {
    case 400:
      return 'http:bad_request' as const;
    case 401:
      return 'http:unauthorized' as const;
    case 403:
      return 'http:forbidden' as const;
    case 404:
      return 'http:not_found' as const;
    case 409:
      return 'http:conflict' as const;
    case 422:
      return 'http:unprocessable' as const;
    case 429:
      return 'http:rate_limited' as const;
    default:
      return 'http:internal' as const;
  }
};

import { mapPrismaError } from '@/core/error-mapper';

/** Global error handler: converts AppError / HTTPException / unknown into JSON responses. */
export const errorMiddleware =
  ({ isDevelopment }: ErrorMiddlewareOptions) =>
  (err: Error, ctx: Context) => {
    const error = mapPrismaError(err) ?? err;

    if (error instanceof AppError) {
      if (error.status >= 500) {
        logger.error({ err: error, code: error.code }, 'AppError (server)');
      } else {
        logger.debug({ code: error.code, message: error.message }, 'AppError (client)');
      }
      return ctx.json(error.toJSON(), error.status);
    }

    if (err instanceof HTTPException) {
      return ctx.json({ error: { code: codeForStatus(err.status), message: err.message } }, err.status);
    }

    logger.error({ err }, 'Unhandled error');
    return ctx.json(
      {
        error: {
          code: 'http:internal',
          message: isDevelopment && err instanceof Error ? err.message : 'Internal server error',
          ...(isDevelopment && err instanceof Error ? { stack: err.stack } : {}),
        },
      },
      500 as ContentfulStatusCode,
    );
  };
