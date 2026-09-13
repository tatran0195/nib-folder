import { QueueNames, scheduleExportMaintenance } from '@nibleaf/bullmq';
import type { NibleafModule } from '@nibleaf/shared';
import { handleEmailJobs } from '../processors/email';
import { handleExportJobs } from '../processors/export';
import { handleGitJobs } from '../processors/git';
import { handlePublishJobs } from '../processors/publish';
import { handleSearchJobs } from '../processors/search';
import { startDeploymentReaper } from '../reaper';

/**
 * Domain worker modules for Nibleaf.
 * Directly modeled on Avkash's modular worker and job manifests.
 */

export const publishWorkerModule: NibleafModule = {
  key: 'deployments',
  title: 'Deployments & Publishing Worker',
  description: 'Consumes publish queue and runs stranded deployment reaper',
  jobs: [
    {
      queueName: QueueNames.PUBLISH,
      handler: handlePublishJobs,
    },
  ],
  schedules: [
    {
      name: 'deployment-reaper',
      intervalMs: 30_000,
      run: startDeploymentReaper,
    },
  ],
};

export const searchWorkerModule: NibleafModule = {
  key: 'search',
  title: 'Search & Embeddings Worker',
  description: 'Processes search indexing, full-text sync, and vector ingestion',
  jobs: [
    {
      queueName: QueueNames.SEARCH,
      handler: handleSearchJobs,
    },
  ],
};

export const emailWorkerModule: NibleafModule = {
  key: 'email',
  title: 'Transactional Email Worker',
  description: 'Processes email delivery queue across SMTP and Postmark',
  jobs: [
    {
      queueName: QueueNames.EMAIL,
      handler: handleEmailJobs,
    },
  ],
};

export const exportWorkerModule: NibleafModule = {
  key: 'exports',
  title: 'Exports & Archival Worker',
  description: 'Generates documentation ZIP and PDF exports and runs export cleanup',
  jobs: [
    {
      queueName: QueueNames.EXPORT,
      handler: handleExportJobs,
    },
  ],
  schedules: [
    {
      name: 'export-maintenance',
      cron: '0 3 * * *',
      run: scheduleExportMaintenance,
    },
  ],
};

export const gitWorkerModule: NibleafModule = {
  key: 'git',
  title: 'Git Sync Worker',
  description: 'Processes asynchronous repository syncing and webhook delivery',
  jobs: [
    {
      queueName: QueueNames.GIT,
      handler: handleGitJobs,
    },
  ],
};

export const WORKER_MODULES: readonly NibleafModule[] = [
  publishWorkerModule,
  searchWorkerModule,
  emailWorkerModule,
  exportWorkerModule,
  gitWorkerModule,
] as const;

export function getRegisteredWorkerModules(): readonly NibleafModule[] {
  return WORKER_MODULES;
}
