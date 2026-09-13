import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    server: {
      OPENROUTER_API_KEY: z.string().optional(),
      APP_URL: z.url().optional(),
      APP_NAME: z.string().default('Nibleaf'),
      AI_DRAFT_MODEL: z.string().default('anthropic/claude-3.5-sonnet'),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  });
