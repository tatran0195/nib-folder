import { Redis } from 'ioredis';

const getEnv = () => ({
  REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  REDIS_DB: Number(process.env.REDIS_DB) || 0,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  SEARCH_ANSWER_DAILY_PER_PROJECT: Number(process.env.SEARCH_ANSWER_DAILY_PER_PROJECT) || 100,
});

let redis: Redis | null = null;

const connection = (): Redis => {
  if (redis) return redis;
  const env = getEnv();
  redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB,
    ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
    protocol: 2,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  redis.on('error', () => undefined);
  return redis;
};

const day = (now: Date): string => now.toISOString().slice(0, 10);

/** Redis-backed project quota. Fail closed when the shared counter is
 * unavailable so a Redis outage cannot turn into unbounded provider spend. */
export const consumeAnswerQuota = async (projectId: string, now = new Date()): Promise<{ allowed: boolean; remaining: number }> => {
  const limit = getEnv().SEARCH_ANSWER_DAILY_PER_PROJECT;
  if (limit === 0) return { allowed: false, remaining: 0 };
  const key = `{search-answer-quota}:${projectId}:${day(now)}`;
  const current = Number(
    await connection().eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],172800) end; return n", 1, key),
  );
  return { allowed: current <= limit, remaining: Math.max(0, limit - current) };
};
