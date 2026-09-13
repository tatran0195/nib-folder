import type { NibleafModule, ScheduledJob } from '@nibleaf/shared';
import { describe, expect, it, vi } from 'vitest';
import { collectSchedules, registerSchedules } from './schedule';

describe('@nibleaf/jobs schedule registry', () => {
  it('collects all scheduled jobs across modules', () => {
    const job1: ScheduledJob = { name: 'job-1', cron: '0 * * * *', run: vi.fn() };
    const job2: ScheduledJob = { name: 'job-2', intervalMs: 5000, run: vi.fn() };

    const moduleA: NibleafModule = {
      key: 'mod-a',
      title: 'Module A',
      schedules: [job1],
    };
    const moduleB: NibleafModule = {
      key: 'mod-b',
      title: 'Module B',
      schedules: [job2],
    };

    const collected = collectSchedules([moduleA, moduleB]);
    expect(collected).toHaveLength(2);
    expect(collected).toEqual([job1, job2]);
  });

  it('registers all repeatable cron jobs on boot', async () => {
    const runCron = vi.fn().mockResolvedValue(undefined);
    const runInterval = vi.fn();

    const moduleA: NibleafModule = {
      key: 'mod-a',
      title: 'Module A',
      schedules: [
        { name: 'cron-job', cron: '0 0 * * *', run: runCron },
        { name: 'interval-job', intervalMs: 1000, run: runInterval },
      ],
    };

    await registerSchedules([moduleA]);

    expect(runCron).toHaveBeenCalledOnce();
    expect(runInterval).not.toHaveBeenCalled();
  });

  it('propagates errors when schedule registration fails', async () => {
    const errorCron = vi.fn().mockRejectedValue(new Error('Redis connection failed'));
    const moduleA: NibleafModule = {
      key: 'mod-faulty',
      title: 'Faulty Module',
      schedules: [{ name: 'failing-cron', cron: '0 0 * * *', run: errorCron }],
    };

    await expect(registerSchedules([moduleA])).rejects.toThrow('Redis connection failed');
  });
});
