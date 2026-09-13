import { workbench } from '@getworkbench/hono';
import { QueueNames } from '@nibleaf/bullmq';
import { getQueue, queues } from '@nibleaf/bullmq/queues';
import { Hono } from 'hono';
import { env } from '../../env';
import { resolveEmailDelivery } from '../../processors/email-delivery';

let workerReady = false;

export const setWorkerReady = (ready: boolean): void => {
  workerReady = ready;
};

export const isWorkerReady = (): boolean => workerReady;

/**
 * Checks Redis connectivity via BullMQ queue probe.
 * Fail-safe probe with timeout guard: never throws, returns boolean.
 */
export async function checkRedisHealth(timeoutMs = 2000): Promise<boolean> {
  try {
    const queue = getQueue(QueueNames.PUBLISH);
    const res = await Promise.race([
      queue.isPaused(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Redis ping timeout')), timeoutMs)),
    ]);
    return typeof res === 'boolean';
  } catch {
    return false;
  }
}

// Workbench — a modern BullMQ dashboard, mounted on the worker's Hono app at /jobs.
const workbenchAuth = env.WORKBENCH_USER && env.WORKBENCH_PASS ? { username: env.WORKBENCH_USER, password: env.WORKBENCH_PASS } : undefined;

const app = new Hono()
  .get('/health', async (ctx) => {
    const email = resolveEmailDelivery({
      postmarkApiKey: env.POSTMARK_API_KEY,
      smtpUrl: env.SMTP_URL,
      required: env.EMAIL_DELIVERY_REQUIRED,
    });
    const status = !workerReady ? 'starting' : email.ready ? 'ok' : 'degraded';

    return ctx.json(
      {
        status,
        service: 'worker',
        revision: process.env.NIBLEAF_REVISION ?? 'development',
        uptime: Math.floor(process.uptime()),
        ready: workerReady,
        email: {
          status: email.provider ? 'ok' : email.required ? 'misconfigured' : 'disabled',
          provider: email.provider ?? 'none',
          required: email.required,
        },
      },
      workerReady ? 200 : 503,
    );
  })
  .get('/health/ready', async (ctx) => {
    const [redisOk] = await Promise.all([checkRedisHealth(2000)]);
    const email = resolveEmailDelivery({
      postmarkApiKey: env.POSTMARK_API_KEY,
      smtpUrl: env.SMTP_URL,
      required: env.EMAIL_DELIVERY_REQUIRED,
    });

    const isReady = workerReady && redisOk && email.ready;
    const status = !workerReady ? 'starting' : !redisOk ? 'unhealthy' : email.ready ? 'ok' : 'degraded';

    return ctx.json(
      {
        status,
        service: 'worker',
        revision: process.env.NIBLEAF_REVISION ?? 'development',
        uptime: Math.floor(process.uptime()),
        checks: {
          worker: workerReady,
          redis: redisOk,
          email: email.ready,
        },
        queues: Object.values(QueueNames),
      },
      isReady ? 200 : 503,
    );
  })
  .route(
    '/jobs',
    workbench({
      queues: Object.values(queues),
      title: 'Nibleaf Queues',
      alerts: { enabled: false },
      ...(workbenchAuth ? { auth: workbenchAuth } : {}),
    }),
  );

export default app;
