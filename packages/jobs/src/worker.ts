import { bootWorkers, closeQueueEvents, closeQueues, closeWorkers, type ProcessorRegistry } from '@nibleaf/bullmq/workers';
import { logger } from '@nibleaf/logger';
import type { NibleafModule } from '@nibleaf/shared';
import { registerSchedules } from './schedule';

export interface WorkerStatus {
  ready: boolean;
  activeQueues: string[];
  moduleCount: number;
  uptimeSeconds: number;
}

export interface WorkerInstance {
  close: () => Promise<void>;
  status: () => WorkerStatus;
}

type TeardownHandle = NodeJS.Timeout | { stop?: () => unknown; close?: () => unknown } | (() => unknown);

/**
 * Compiles a ProcessorRegistry from modular manifests.
 */
export function compileProcessors(modules: readonly NibleafModule[]): ProcessorRegistry {
  const processors: Record<string, (job: never) => Promise<unknown>> = {};
  for (const mod of modules) {
    for (const job of mod.jobs ?? []) {
      processors[job.queueName] = job.handler;
    }
  }
  return processors as ProcessorRegistry;
}

/**
 * Boots background BullMQ workers and schedules from module manifests.
 * Directly modeled on Avkash's `startWorker` and `registerSchedules` modular orchestration.
 */
export async function startWorker(modules: readonly NibleafModule[], onReady?: (ready: boolean) => void): Promise<WorkerInstance> {
  const activeTeardowns: TeardownHandle[] = [];
  const processors = compileProcessors(modules);
  const startTime = Date.now();
  let isReady = false;

  logger.info({ moduleCount: modules.length, queues: Object.keys(processors) }, 'booting modular workers');
  await bootWorkers(processors);

  // Register repeatable jobs declared by modules
  await registerSchedules(modules);

  // Start in-process maintenance interval timers declared by modules
  for (const mod of modules) {
    for (const schedule of mod.schedules ?? []) {
      if (schedule.intervalMs) {
        try {
          const handle = (await schedule.run()) as unknown;
          if (handle) {
            activeTeardowns.push(handle as TeardownHandle);
          }
          logger.info({ module: mod.key, schedule: schedule.name, intervalMs: schedule.intervalMs }, 'maintenance interval timer started');
        } catch (error) {
          logger.error({ module: mod.key, schedule: schedule.name, error }, 'failed to start maintenance interval schedule');
        }
      }
    }
  }

  isReady = true;
  onReady?.(true);
  logger.info({ queues: Object.keys(processors) }, 'Queue workers and schedules started');

  return {
    close: async () => {
      isReady = false;
      onReady?.(false);
      for (const handle of activeTeardowns) {
        try {
          if (typeof handle === 'function') {
            await handle();
          } else if (typeof handle === 'object' && handle !== null) {
            if ('stop' in handle && typeof handle.stop === 'function') {
              await handle.stop();
            } else if ('close' in handle && typeof handle.close === 'function') {
              await handle.close();
            } else {
              clearInterval(handle as NodeJS.Timeout);
            }
          }
        } catch (error) {
          logger.warn({ error }, 'error during schedule teardown');
        }
      }
      activeTeardowns.length = 0;
      await Promise.allSettled([closeWorkers(), closeQueueEvents(), closeQueues()]);
    },
    status: () => ({
      ready: isReady,
      activeQueues: Object.keys(processors),
      moduleCount: modules.length,
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    }),
  };
}
