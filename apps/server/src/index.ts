import './lib/serialize-bigint';

// trigger bun reload
import { type ServerType, serve } from '@hono/node-server';
import { closeQueues } from '@nibleaf/bullmq';
import { logger } from '@nibleaf/logger';
import { configureUploadCors, ensureBucket } from '@nibleaf/storage';
import { createApp } from './create-app';
import { env } from './env';
import { OPEN_MODULES } from './modules/registry';

// Fail fast on unhandled async/sync errors rather than running in an undefined state.
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'uncaughtException');
  process.exit(1);
});

let bunServer: { port?: number; stop: (closeActiveConnections?: boolean) => void | Promise<void> } | null = null;
let nodeServer: ServerType | null = null;
let shuttingDown = false;
let ready = false;

export const app = createApp(OPEN_MODULES, {
  isShuttingDown: () => shuttingDown,
  isReady: () => ready,
});

async function main() {
  if (typeof Bun !== 'undefined') {
    const bun = Bun.serve({
      port: env.API_PORT,
      fetch: app.fetch,
    });
    bunServer = bun;
    const port = bun.port ?? env.API_PORT;
    logger.info(`Nibleaf API (Bun) on http://localhost:${port}`);
    logger.info(`  docs   → http://localhost:${port}/docs`);
    logger.info(`  health → http://localhost:${port}/health`);
  } else {
    nodeServer = serve({ port: env.API_PORT, fetch: app.fetch }, (info) => {
      logger.info(`Nibleaf API on http://localhost:${info.port}`);
      logger.info(`  docs   → http://localhost:${info.port}/docs`);
      logger.info(`  health → http://localhost:${info.port}/health`);
    });
  }

  // Best-effort storage bootstrap: create the bucket + allow browser uploads.
  await ensureBucket().catch((error) => logger.warn({ error }, 'ensureBucket failed (continuing)'));
  if (env.STORAGE_AUTO_CORS) {
    await configureUploadCors(env.STORAGE_CORS_ALLOWED_ORIGINS)
      .then(() => logger.info({ origins: env.STORAGE_CORS_ALLOWED_ORIGINS }, 'bucket CORS applied for direct uploads'))
      .catch((error) => logger.warn({ error }, 'bucket CORS apply failed (browser uploads may be blocked)'));
  }

  ready = true;
  logger.info({ revision: process.env.NIBLEAF_REVISION ?? 'development' }, 'API ready');
}

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  ready = false;
  logger.info({ signal }, 'shutting down API');

  if (bunServer) {
    bunServer.stop();
  }
  if (nodeServer) {
    let timeout: NodeJS.Timeout | undefined;
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        nodeServer?.close((error) => (error ? reject(error) : resolve()));
      }),
      new Promise<void>((resolve) => {
        timeout = setTimeout(() => {
          logger.warn({ timeoutMs: env.SERVER_SHUTDOWN_TIMEOUT_MS }, 'API drain timed out; closing active connections');
          (nodeServer as typeof nodeServer & { closeAllConnections?: () => void })?.closeAllConnections?.();
          resolve();
        }, env.SERVER_SHUTDOWN_TIMEOUT_MS);
        timeout.unref();
      }),
    ]).finally(() => {
      if (timeout) {
        clearTimeout(timeout);
      }
    });
  }
  await Promise.allSettled([closeQueues()]);
  process.exit(0);
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((error) => {
    logger.error({ error }, 'API shutdown failed');
    process.exit(1);
  });
});
process.on('SIGINT', () => {
  shutdown('SIGINT').catch((error) => {
    logger.error({ error }, 'API shutdown failed');
    process.exit(1);
  });
});

main().catch((error) => {
  logger.error({ error }, 'fatal API startup error');
  process.exit(1);
});

