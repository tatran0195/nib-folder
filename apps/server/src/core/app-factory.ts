import { Hono } from 'hono';
import type { HonoEnv } from '@/lib/hono/context';
import type { NibleafModule } from './module';

export interface ModularRouters {
  rootRouter: Hono<HonoEnv>;
  appRouter: Hono<HonoEnv>;
  publicRouter: Hono<HonoEnv>;
  adminRouter: Hono<HonoEnv>;
  mcpRouter: Hono<HonoEnv>;
}

/**
 * Pluggable App Factory (inspired by Avkash's `createApp(modules)`).
 *
 * Iterates through declared domain module manifests and mounts their sub-routers
 * into dedicated namespaces (/app, /public, /admin, /mcp).
 * Adding or removing features only requires updating the active modules registry.
 */
export function createModularApp(modules: NibleafModule[]): ModularRouters {
  const appRouter = new Hono<HonoEnv>();
  const publicRouter = new Hono<HonoEnv>();
  const adminRouter = new Hono<HonoEnv>();
  const mcpRouter = new Hono<HonoEnv>();

  for (const mod of modules) {
    mod.appRoutes?.(appRouter);
    mod.publicRoutes?.(publicRouter);
    mod.adminRoutes?.(adminRouter);
    mod.mcpRoutes?.(mcpRouter);
  }

  const rootRouter = new Hono<HonoEnv>()
    .route('/app', appRouter)
    .route('/public', publicRouter)
    .route('/admin', adminRouter)
    .route('/mcp', mcpRouter);

  return {
    rootRouter,
    appRouter,
    publicRouter,
    adminRouter,
    mcpRouter,
  };
}
