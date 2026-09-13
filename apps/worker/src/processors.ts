import { QueueNames } from '@nibleaf/bullmq';
import type { ProcessorRegistry } from '@nibleaf/bullmq/workers';
import { handleEmailJobs } from './processors/email';
import { handleExportJobs } from './processors/export';
import { handleGitJobs } from './processors/git';
import { handlePublishJobs } from './processors/publish';
import { handleSearchJobs } from './processors/search';

export const processors: ProcessorRegistry = {
  [QueueNames.PUBLISH]: handlePublishJobs,
  [QueueNames.SEARCH]: handleSearchJobs,
  [QueueNames.EMAIL]: handleEmailJobs,
  [QueueNames.EXPORT]: handleExportJobs,
  [QueueNames.GIT]: handleGitJobs,
};
