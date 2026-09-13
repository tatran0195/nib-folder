import { describe, expect, it } from 'vitest';
import app, { setWorkerReady } from './handlers';

interface HealthResponseBody {
  status: string;
  service: string;
  ready?: boolean;
  uptime?: number;
  checks?: {
    worker: boolean;
    redis: boolean;
    email: boolean;
  };
}

describe('worker system handlers', () => {
  it('reports starting/degraded status on /health when not ready', async () => {
    setWorkerReady(false);
    const res = await app.request('/health');
    expect(res.status).toBe(503);
    const body = (await res.json()) as HealthResponseBody;
    expect(body.status).toBe('starting');
    expect(body.service).toBe('worker');
    expect(body.ready).toBe(false);
  });

  it('reports 200 ok on /health when workerReady is true', async () => {
    setWorkerReady(true);
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthResponseBody;
    expect(body.service).toBe('worker');
    expect(body.ready).toBe(true);
    expect(body.uptime).toBeTypeOf('number');
  });

  it('reports readiness on /health/ready', async () => {
    setWorkerReady(true);
    const res = await app.request('/health/ready');
    // Depending on whether local Redis is running during test, status will be 200 or 503
    expect([200, 503]).toContain(res.status);
    const body = (await res.json()) as HealthResponseBody;
    expect(body.service).toBe('worker');
    expect(body.checks).toBeDefined();
    expect(body.checks?.worker).toBe(true);
  });
});
