import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queueMocks } = vi.hoisted(() => ({
  queueMocks: {
    export: { add: vi.fn(), getJob: vi.fn(), getJobSchedulers: vi.fn(async () => []), upsertJobScheduler: vi.fn() },
  },
}));

vi.mock('./queues/index', () => ({
  getQueue: (_name: string) => queueMocks.export,
}));

vi.mock('./utils/logger', () => ({
  queueLogger: { debug: vi.fn(), info: vi.fn() },
}));

import { scheduleExportMaintenance } from './index';

describe('BullMQ 6 job schedulers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts export schedulers instead of removed repeatable-job options', async () => {
    await scheduleExportMaintenance();

    expect(queueMocks.export.upsertJobScheduler).toHaveBeenCalledTimes(2);
    expect(queueMocks.export.upsertJobScheduler).toHaveBeenCalledWith(
      'dispatch-export-schedules',
      { pattern: '* * * * *', tz: 'UTC' },
      expect.objectContaining({ name: 'dispatch-export-schedules' }),
    );
    expect(queueMocks.export.upsertJobScheduler).toHaveBeenCalledWith(
      'cleanup-exports',
      { pattern: '17 2 * * *', tz: 'UTC' },
      expect.objectContaining({ name: 'cleanup-exports' }),
    );
    expect(queueMocks.export.add).not.toHaveBeenCalled();
  });
});
