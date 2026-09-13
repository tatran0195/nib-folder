import type { ProcessorRegistry } from '@nibleaf/bullmq/workers';
import { WORKER_MODULES } from './modules/registry';
import { compileProcessors } from './worker';

export const processors: ProcessorRegistry = compileProcessors(WORKER_MODULES);
