import { MemberRole } from '@nibleaf/shared/constants';
import { errorResponses } from '@/errors/utils';
import { createRouteConfig } from '@/lib/hono/route-config';
import { isAuthenticated, requireRole } from '@/middlewares/guard';

const ok = { 200: { description: 'ok' }, ...errorResponses };

const workspaceRoutes = {
  settings: createRouteConfig({ guard: isAuthenticated, tags: ['workspace'], description: 'Get workspace settings.', responses: ok }),
  updateSettings: createRouteConfig({
    guard: [isAuthenticated, requireRole(MemberRole.ADMIN)],
    tags: ['workspace'],
    description: 'Update workspace settings.',
    responses: ok,
  }),
};

export default workspaceRoutes;
