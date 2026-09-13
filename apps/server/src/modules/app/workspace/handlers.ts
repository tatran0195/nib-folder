import { updateWorkspaceSettingsBody } from '@nibleaf/validators';
import { Hono } from 'hono';
import { getWorkspaceSettings, updateWorkspaceSettings } from '@/actions/workspace';
import { getContextOrganizationIdOrThrow, type HonoEnv } from '@/lib/hono/context';
import { validator } from '@/lib/hono/validate';
import workspaceRoutes from './routes';

const app = new Hono<HonoEnv>()
  .get('/', ...workspaceRoutes.settings, async (ctx) => {
    const organizationId = getContextOrganizationIdOrThrow();
    return ctx.json({ data: await getWorkspaceSettings(organizationId) }, 200);
  })
  .patch('/', ...workspaceRoutes.updateSettings, validator('json', updateWorkspaceSettingsBody), async (ctx) => {
    const organizationId = getContextOrganizationIdOrThrow();
    return ctx.json({ data: await updateWorkspaceSettings(organizationId, ctx.req.valid('json')) }, 200);
  });

export default app;
