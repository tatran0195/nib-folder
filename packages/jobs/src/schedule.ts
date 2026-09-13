import { logger } from '@nibleaf/logger';
import type { NibleafModule, ScheduledJob } from '@nibleaf/shared';

/**
 * Collects all scheduled jobs from a list of domain modules.
 */
export function collectSchedules(modules: readonly NibleafModule[]): ScheduledJob[] {
  const schedules: ScheduledJob[] = [];
  for (const mod of modules) {
    if (mod.schedules) {
      schedules.push(...mod.schedules);
    }
  }
  return schedules;
}

export async function registerSchedules(modules: readonly NibleafModule[]): Promise<void> {
  for (const mod of modules) {
    for (const schedule of mod.schedules ?? []) {
      if (schedule.cron) {
        await schedule.run();
        logger.info({ module: mod.key, schedule: schedule.name, cron: schedule.cron }, 'registered repeatable cron schedule');
      }
    }
  }
}
