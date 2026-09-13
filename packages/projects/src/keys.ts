import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    server: {
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      BETTER_AUTH_SECRET: z.string().default('dev-secret-change-me-please-32chars-min'),
      APP_URL: z.url().default('http://localhost:4310'),
      SITE_BASE_DOMAIN: z.string().optional(),
      CUSTOM_DOMAIN_CNAME_TARGET: z.string().optional(),
      SEARCH_RUNTIME: z.enum(['legacy', 'shadow', 'hybrid']).default('legacy'),
      QDRANT_COLLECTION_VERSION: z.string().default('v1'),
      SEARCH_EMBEDDING_MODEL: z.string().default('openai/text-embedding-3-small'),
      SEARCH_EMBEDDING_DIMENSIONS: z.coerce.number().int().min(64).max(8192).default(1536),
      OPENROUTER_API_KEY: z.string().optional(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  });
