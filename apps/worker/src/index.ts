import { type ServerType, serve } from '@hono/node-server';
import { closeQueueEvents, closeQueues } from '@nibleaf/bullmq';
import { logger } from '@nibleaf/logger';
import workerApp from './app';
import { env } from './env';
import { checkRedisHealth, setWorkerReady } from './modules/system/handlers';
import { resolveEmailDelivery } from './processors/email-delivery';
import { startWorker, type WorkerInstance } from './worker';

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason instanceof Error ? reason : new Error(String(reason)) }, 'unhandled rejection');
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'uncaught exception');
  process.exit(1);
});

const SHUTDOWN_TIMEOUT_MS = 15_000;
let bunServer: { port?: number; stop: (closeActiveConnections?: boolean) => Promise<void> | void } | null = null;
let nodeServer: ServerType | null = null;
let workerInstance: WorkerInstance | null = null;
let shuttingDown = false;

async function preflightDiagnostics() {
  logger.info({ revision: process.env.NIBLEAF_REVISION ?? 'development', env: env.NODE_ENV }, 'Nibleaf worker initializing');

  // Check email provider readiness
  const email = resolveEmailDelivery({
    postmarkApiKey: env.POSTMARK_API_KEY,
    smtpUrl: env.SMTP_URL,
    required: env.EMAIL_DELIVERY_REQUIRED,
  });
  logger.info({ provider: email.provider ?? 'none', required: email.required, ready: email.ready }, '[email] provider resolved');

  // Pre-flight Redis check (non-fatal, logs warning if disconnected so BullMQ can reconnect)
  const redisHealthy = await checkRedisHealth(3000);
  if (redisHealthy) {
    logger.info('[redis] connection verified');
  } else {
    logger.warn('[redis] ping check timed out or failed — worker will retry via BullMQ connection strategy');
  }
}

async function main() {
  await preflightDiagnostics();

  if (typeof Bun !== 'undefined') {
    const bun = Bun.serve({
      port: env.WORKER_PORT,
      fetch: workerApp.fetch,
    });
    bunServer = bun;
    const port = bun.port ?? env.WORKER_PORT;
    logger.info(`Nibleaf worker ops server (Bun) on http://localhost:${port}`);
    logger.info(`  health → http://localhost:${port}/health`);
    logger.info(`  ready  → http://localhost:${port}/health/ready`);
    logger.info(`  jobs   → http://localhost:${port}/jobs`);
  } else {
    nodeServer = serve({ port: env.WORKER_PORT, fetch: workerApp.fetch }, (info) => {
      logger.info(`Nibleaf worker ops server on http://localhost:${info.port}`);
      logger.info(`  health → http://localhost:${info.port}/health`);
      logger.info(`  ready  → http://localhost:${info.port}/health/ready`);
      logger.info(`  jobs   → http://localhost:${info.port}/jobs`);
    });
  }

  workerInstance = await startWorker();
  const status = workerInstance.status();
  logger.info({ activeQueues: status.activeQueues, moduleCount: status.moduleCount }, 'Nibleaf worker up — queues and schedules active');
}

async function cleanup() {
  setWorkerReady(false);

  // 1. Close background workers and cancel interval timers
  if (workerInstance) {
    try {
      await workerInstance.close();
      logger.info('worker instance closed');
    } catch (error) {
      logger.error({ error }, 'error closing worker instance');
    }
  }

  // 2. Stop HTTP servers
  if (bunServer) {
    try {
      await bunServer.stop(true);
    } catch (error) {
      logger.warn({ error }, 'error stopping bun server');
    }
  }

  if (nodeServer) {
    await new Promise<void>((resolve) => {
      nodeServer?.close((error) => {
        if (error) {
          logger.warn({ error }, 'error closing node server');
        }
        resolve();
      });
      (nodeServer as typeof nodeServer & { closeAllConnections?: () => void })?.closeAllConnections?.();
    });
  }

  // 3. Close remaining BullMQ queues and queue events
  await Promise.allSettled([closeQueueEvents(), closeQueues()]);
}

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info({ signal }, `${signal} received — gracefully shutting down worker…`);

  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutHandle = setTimeout(() => {
      logger.warn({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'worker cleanup timed out; forcing exit');
      resolve();
    }, SHUTDOWN_TIMEOUT_MS);
    timeoutHandle.unref?.();
  });

  try {
    await Promise.race([cleanup(), timeoutPromise]);
  } catch (error) {
    logger.error({ error }, 'unexpected error during worker shutdown');
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    process.exit(0);
  }
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch(() => process.exit(1));
});
process.on('SIGINT', () => {
  shutdown('SIGINT').catch(() => process.exit(1));
});

main().catch((error) => {
  logger.error({ error }, 'fatal worker startup error');
  process.exit(1);
});

