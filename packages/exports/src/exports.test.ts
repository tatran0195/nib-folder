import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assetFindMany: vi.fn(),
  createJob: vi.fn(),
  deploymentFindFirst: vi.fn(),
  exportJobCount: vi.fn(),
  exportJobCreate: vi.fn(),
  exportJobUpdate: vi.fn(),
  exportScheduleFindFirst: vi.fn(),
  exportSnapshotCreate: vi.fn(),
  logPlatformEvent: vi.fn(),
}));

vi.mock('@nibleaf/bullmq', () => ({
  createJob: mocks.createJob,
  getJob: vi.fn(),
  QueueNames: { EXPORT: 'export' },
  removeJob: vi.fn(),
}));
vi.mock('@nibleaf/database', () => ({
  Prisma: { DbNull: Symbol('DbNull') },
  prisma: {
    asset: { findMany: mocks.assetFindMany },
    deployment: { findFirst: mocks.deploymentFindFirst },
    exportArtifact: { findFirst: vi.fn() },
    exportJob: { count: mocks.exportJobCount, create: mocks.exportJobCreate, update: mocks.exportJobUpdate },
    exportSchedule: { findFirst: mocks.exportScheduleFindFirst },
    exportSnapshot: { create: mocks.exportSnapshotCreate },
  },
}));
vi.mock('@nibleaf/storage', () => ({ presignGetUrl: vi.fn() }));

import { runExportSchedule, setPlatformEventLogger } from './exports';

describe('runExportSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPlatformEventLogger(mocks.logPlatformEvent);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00.000Z'));
    mocks.exportJobCount.mockResolvedValue(0);
    mocks.exportScheduleFindFirst.mockResolvedValue({
      id: 'schedule-1',
      projectId: 'project-1',
      formats: ['MARKDOWN', 'PDF'],
      retentionDays: 30,
    });
    mocks.deploymentFindFirst.mockResolvedValue({
      id: 'deployment-4',
      version: 4,
      pagesCount: 2,
      snapshot: { project: { id: 'project-1' }, pages: [] },
    });
    mocks.assetFindMany.mockResolvedValue([]);
    mocks.exportSnapshotCreate.mockResolvedValue({ id: 'snapshot-1', deploymentVersion: 4 });
    mocks.exportJobCreate.mockResolvedValue({ id: 'export-1' });
    mocks.createJob.mockResolvedValue({ id: 'export-export-1' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps schedule identity, trigger, and retention on an immediate run', async () => {
    await runExportSchedule('project-1', 'schedule-1', 'user-1');

    expect(mocks.exportJobCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'project-1',
          scheduleId: 'schedule-1',
          trigger: 'SCHEDULED',
          formats: ['MARKDOWN', 'PDF'],
          expiresAt: new Date('2026-09-16T12:00:00.000Z'),
        }),
      }),
    );
    expect(mocks.createJob).toHaveBeenCalledWith(
      'export',
      { name: 'render-export', data: { exportJobId: 'export-1' } },
      { jobId: 'export-export-1' },
    );
  });
});
