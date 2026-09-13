import { bootWorkers, closeQueueEvents, closeQueues, closeWorkers, type ProcessorRegistry } from '@nibleaf/bullmq/workers';
import { logger } from '@nibleaf/logger';
import type { NibleafModule } from '@nibleaf/shared';
import { registerSchedules } from './schedule';

export interface WorkerInstance {
  close: () => Promise<void>;
  status: () => { ready: boolean; activeQueues: string[] };
}

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
  const activeTimers: NodeJS.Timeout[] = [];
  const processors = compileProcessors(modules);

  logger.info({ moduleCount: modules.length, queues: Object.keys(processors) }, 'booting modular workers');
  await bootWorkers(processors);

  // Register repeatable jobs declared by modules
  await registerSchedules(modules);

  // Start in-process maintenance interval timers declared by modules
  for (const mod of modules) {
    for (const schedule of mod.schedules ?? []) {
      if (schedule.intervalMs) {
        const timer = schedule.run() as unknown;
        if (timer && typeof timer === 'object' && 'unref' in timer) {
          activeTimers.push(timer as NodeJS.Timeout);
        }
        logger.info({ module: mod.key, schedule: schedule.name }, 'maintenance interval timer started');
      }
    }
  }

  onReady?.(true);
  logger.info('Queue workers and schedules started');

  return {
    close: async () => {
      onReady?.(false);
      for (const timer of activeTimers) {
        clearInterval(timer);
      }
      await Promise.allSettled([closeWorkers(), closeQueueEvents(), closeQueues()]);
    },
    status: () => ({
      ready: true,
      activeQueues: Object.keys(processors),
    }),
  };
}
