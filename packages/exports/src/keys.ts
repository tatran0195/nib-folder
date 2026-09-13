import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    server: {
      EXPORT_MAX_ACTIVE_PER_PROJECT: z.coerce.number().int().min(1).max(20).default(3),
      EXPORT_MAX_DAILY_PER_PROJECT: z.coerce.number().int().min(1).max(1000).default(20),
      EXPORT_MAX_PAGES: z.coerce.number().int().positive().default(5000),
      EXPORT_MAX_SNAPSHOT_BYTES: z.coerce
        .number()
        .int()
        .positive()
        .default(50 * 1024 * 1024),
      EXPORT_MANUAL_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(7),
      EXPORT_DOWNLOAD_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  });
