import { prisma } from '@nibleaf/database';

/**
 * Bounded database readiness probe.
 * Executes a cheap round-trip to verify database connectivity.
 * Times out if the database is unresponsive, preventing hanging health checks.
 * Inspired by Avkash's ping() readiness check.
 */
export async function pingDatabase(timeoutMs = 2000): Promise<boolean> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('Database ping timed out')), timeoutMs);
        timer.unref?.();
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}
