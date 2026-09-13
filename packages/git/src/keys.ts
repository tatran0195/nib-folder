import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    server: {
      APP_URL: z.string().default('http://localhost:4310'),
      GIT_CREDENTIAL_ENCRYPTION_KEY: z.string().optional(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  });
