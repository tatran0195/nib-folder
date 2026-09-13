import { startWorker as bootJobsWorker, compileProcessors, type WorkerInstance } from '@nibleaf/jobs';
import type { NibleafModule } from '@nibleaf/shared';
import { WORKER_MODULES } from './modules/registry';
import { setWorkerReady } from './modules/system/handlers';

export type { WorkerInstance };
export { compileProcessors };

/**
 * Boots background BullMQ workers and schedules from module manifests using @nibleaf/jobs.
 * Avkash modular runtime orchestration.
 */
export async function startWorker(modules: readonly NibleafModule[] = WORKER_MODULES): Promise<WorkerInstance> {
  return bootJobsWorker(modules, setWorkerReady);
}
