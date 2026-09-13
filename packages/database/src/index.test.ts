import { describe, expect, it } from 'vitest';
import * as db from './index';

describe('@nibleaf/database', () => {
  it('exports Prisma namespace and client symbols', () => {
    expect(db.Prisma).toBeDefined();
    expect(db.prisma).toBeDefined();
  });

  it('confirms usage and billing models are removed', () => {
    expect((db as Record<string, unknown>).UsagePlan).toBeUndefined();
    expect((db as Record<string, unknown>).UsageMeter).toBeUndefined();
    expect((db as Record<string, unknown>).UsageEntitlement).toBeUndefined();
    expect((db as Record<string, unknown>).AnalyticsEvent).toBeUndefined();
  });
});
