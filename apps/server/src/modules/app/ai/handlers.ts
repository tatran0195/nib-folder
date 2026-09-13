import { aiDraftBody } from '@nibleaf/validators';
import { Hono } from 'hono';
import { z } from 'zod';
import { draftContentWithTelemetry } from '@/actions/ai';
import { assertProjectInOrg } from '@/actions/projects';
import { assertAiQuota } from '@/lib/ai-quota';
import { getContextOrganizationIdOrThrow, type HonoEnv } from '@/lib/hono/context';
import { validator } from '@/lib/hono/validate';
import aiRoutes from './routes';

const app = new Hono<HonoEnv>().post('/', ...aiRoutes.draft, validator('json', aiDraftBody), async (ctx) => {
  const organizationId = getContextOrganizationIdOrThrow();
  const projectId = z.string().parse(ctx.req.param('projectId'));
  await assertProjectInOrg(organizationId, projectId);
  // Per-workspace daily budget — the only endpoint with per-request platform
  // spend. Throws 429 when exhausted; no-ops when running on the offline fallback.
  await assertAiQuota(organizationId);
  const result = await draftContentWithTelemetry(ctx.req.valid('json'));
  return ctx.json({ data: { text: result.text } }, 200);
});

export default app;
