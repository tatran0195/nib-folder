import { type ServerType, serve } from '@hono/node-server';
import { logger } from '@nibleaf/logger';
import workerApp from './app';
import { env } from './env';
import { startWorker, type WorkerInstance } from './worker';

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason instanceof Error ? reason : new Error(String(reason)) }, 'unhandled rejection');
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'uncaught exception');
  process.exit(1);
});

let bunServer: { port?: number; stop: (closeActiveConnections?: boolean) => Promise<void> | void } | null = null;
let nodeServer: ServerType | null = null;
let workerInstance: WorkerInstance | null = null;

async function main() {
  if (typeof Bun !== 'undefined') {
    const bun = Bun.serve({
      port: env.WORKER_PORT,
      fetch: workerApp.fetch,
    });
    bunServer = bun;
    const port = bun.port ?? env.WORKER_PORT;
    logger.info(`Nibleaf worker ops server (Bun) on http://localhost:${port}`);
    logger.info(`  health → http://localhost:${port}/health`);
    logger.info(`  jobs   → http://localhost:${port}/jobs`);
  } else {
    nodeServer = serve({ port: env.WORKER_PORT, fetch: workerApp.fetch }, (info) => {
      logger.info(`Nibleaf worker ops server on http://localhost:${info.port}`);
      logger.info(`  health → http://localhost:${info.port}/health`);
      logger.info(`  jobs   → http://localhost:${info.port}/jobs`);
    });
  }

  workerInstance = await startWorker();
}

async function cleanup() {
  if (workerInstance) {
    await workerInstance.close();
  }
  bunServer?.stop?.();
  nodeServer?.close();
}

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down worker');
  await cleanup();
  process.exit(0);
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

export default workerApp;
