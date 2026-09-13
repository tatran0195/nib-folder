import { auth } from '@nibleaf/auth/server';
import { type NibleafModule, pingDatabase } from '@nibleaf/core';
import { prisma } from '@nibleaf/database';
import { Scalar } from '@scalar/hono-api-reference';
import { type Context, Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { openAPIRouteHandler } from 'hono-openapi';
import { env } from './env';
import { AppError } from './errors';
import { errorMiddleware } from './errors/handler';
import { protectPrivateDeliveryFailureResponse } from './lib/delivery-cache';
import type { HonoEnv } from './lib/hono/context';
import { sessionMiddleware } from './middlewares/auth';
import { localeMiddleware } from './middlewares/locale';
import { observabilityMiddleware } from './middlewares/observability';
import { rateLimit } from './middlewares/rate-limit';
import { securityHeaders } from './middlewares/security-headers';
import modulesRouter from './modules';
import mcp from './modules/mcp';
import { OPEN_MODULES } from './modules/registry';
import { wireDomainPackages } from './wire';

const adminOrigin = new URL(env.ADMIN_URL);

/**
 * Customer OTP sign-in may create an account, but the isolated admin origin
 * is account-only. Check the browser Origin first and proxy
 * forwarding headers as a backstop; the internal API is not publicly exposed.
 */
const isAdminOriginRequest = (request: Request): boolean => {
  const candidates = [request.headers.get('origin'), request.headers.get('referer'), request.headers.get('x-forwarded-host')]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return value.includes('://') ? new URL(value).host : value.split(',')[0]?.trim();
      } catch {
        return null;
      }
    });
  return candidates.includes(adminOrigin.host);
};

const emailFromJsonBody = async (request: Request): Promise<string | null> => {
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    return typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
};

const isPlatformAdminEmail = async (email: string | null): Promise<boolean> => {
  if (!email) {
    return false;
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  return user?.role === 'admin';
};

export interface AppLifecycleState {
  isShuttingDown: () => boolean;
  isReady: () => boolean;
}

/**
 * Assembles the Hono application from declarative domain module manifests.
 * Directly modeled on Avkash's `createApp(modules)` architecture.
 *
 * Sequence:
 *   1. Platform middleware (request ID, context storage, observability, security, CORS, locale, session).
 *   2. Probes & documentation (/health, /health/ready, /docs, /openapi.json).
 *   3. Authentication & developer login routes (/api/auth/*, /dev-login).
 *   4. Module routes mounting from module manifests (/api/app, /api/public, /api/admin, /api/mcp).
 *   5. Unified error envelope & 404 handler.
 */
export function createApp(
  modules: readonly NibleafModule[] = OPEN_MODULES,
  lifecycle: AppLifecycleState = { isShuttingDown: () => false, isReady: () => true },
) {
  wireDomainPackages();
  const baseApp = new Hono<HonoEnv>({ strict: false });

  // ── Platform middleware ───────────────────────────────────────────────────
  baseApp.use('*', requestId());
  baseApp.use(contextStorage());
  baseApp.use('*', observabilityMiddleware());
  baseApp.use('*', securityHeaders());
  baseApp.use(
    '*',
    cors({
      origin: env.CORS_ALLOWED_ORIGINS,
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization', 'X-Nibleaf-Locale', 'MCP-Protocol-Version', 'Mcp-Method', 'Mcp-Name', 'Last-Event-ID'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  baseApp.use('*', localeMiddleware());
  baseApp.use('*', sessionMiddleware());

  // ── Health probes (liveness & deep readiness) ──────────────────────────────
  baseApp.get('/health/ready', async (ctx) => {
    if (lifecycle.isShuttingDown()) {
      return ctx.json({ status: 'unavailable', reason: 'shutting_down' }, 503);
    }
    const dbOk = await pingDatabase(2000);
    if (!dbOk) {
      return ctx.json({ status: 'unavailable', reason: 'database' }, 503);
    }
    return ctx.json({ status: 'ready', service: env.SERVICE_NAME, revision: process.env.NIBLEAF_REVISION ?? 'development' }, 200);
  });

  baseApp.get('/health', async (ctx) => {
    const shuttingDown = lifecycle.isShuttingDown();
    const ready = lifecycle.isReady();
    const status = shuttingDown ? 'shutting_down' : ready ? 'ok' : 'starting';
    return ctx.json(
      { status, service: env.SERVICE_NAME, revision: process.env.NIBLEAF_REVISION ?? 'development' },
      ready && !shuttingDown ? 200 : 503,
    );
  });

  // ── API Documentation ──────────────────────────────────────────────────────
  baseApp.get(
    '/openapi.json',
    openAPIRouteHandler(baseApp, {
      documentation: {
        info: { title: 'Nibleaf API', version: '0.1.1', description: 'Open-source documentation platform.' },
        servers: [{ url: env.API_URL, description: 'Nibleaf API' }],
      },
    }),
  );

  baseApp.get('/docs', Scalar({ theme: 'default', sources: [{ url: '/openapi.json', title: 'Nibleaf API' }] }));

  // ── Developer Login Helpers (non-production) ──────────────────────────────
  const handleDevLogin = async (ctx: Context<HonoEnv>) => {
    if (env.NODE_ENV === 'production') {
      return ctx.text('Not allowed in production', 403);
    }
    const otp = await auth.api.createVerificationOTP({ body: { email: 'demo@nibleaf.test', type: 'sign-in' } });
    const res = await auth.api.signInEmailOTP({ body: { email: 'demo@nibleaf.test', otp }, asResponse: true });
    const cookie = res.headers.get('set-cookie');
    if (cookie) {
      ctx.header('set-cookie', cookie);
    }
    return ctx.redirect(new URL('/app', env.APP_URL).toString(), 302);
  };
  baseApp.get('/api/dev-login', handleDevLogin);
  baseApp.get('/dev-login', handleDevLogin);

  // ── Authentication Router ──────────────────────────────────────────────────
  const apiApp = new Hono<HonoEnv>()
    .use('/auth/*', rateLimit({ windowMs: 60_000, max: 30 }))
    .use('/auth/email-otp/send-verification-otp', async (ctx, next) => {
      if (ctx.req.method === 'POST' && isAdminOriginRequest(ctx.req.raw)) {
        const email = await emailFromJsonBody(ctx.req.raw);
        if (!(await isPlatformAdminEmail(email))) {
          return ctx.json({ success: true });
        }
      }
      await next();
    })
    .use('/auth/sign-in/email-otp', async (ctx, next) => {
      if (ctx.req.method === 'POST') {
        try {
          const cloned = ctx.req.raw.clone();
          const body = (await cloned.json()) as { email?: string; otp?: string };
          if (
            env.NODE_ENV !== 'production' &&
            body.email === 'demo@nibleaf.test' &&
            (body.otp === '000000' || body.otp === '123456' || body.otp === '404010')
          ) {
            const otp = await auth.api.createVerificationOTP({ body: { email: 'demo@nibleaf.test', type: 'sign-in' } });
            const res = await auth.api.signInEmailOTP({ body: { email: 'demo@nibleaf.test', otp }, asResponse: true });
            return res;
          }
          if (isAdminOriginRequest(ctx.req.raw) && !(await isPlatformAdminEmail(body.email ?? ''))) {
            return ctx.json({ code: 'INVALID_OTP', message: 'Invalid OTP' }, 400);
          }
        } catch {
          // Continue to regular handler if JSON parsing fails
        }
      }
      await next();
    })
    .get('/auth/reset-password/:token', (ctx) => ctx.redirect(new URL('/sign-in', env.APP_URL).toString(), 302))
    .on(['POST', 'GET'], '/auth/*', (ctx) => auth.handler(ctx.req.raw))
    .route('/mcp', mcp)
    .route('/', modulesRouter);

  // ── Mount module manifests ─────────────────────────────────────────────────
  for (const mod of modules) {
    mod.routes?.(baseApp);
  }

  const app = baseApp.route('/api', apiApp);

  // ── Unified 404 & Error Envelope ───────────────────────────────────────────
  app.notFound((ctx) => {
    throw new AppError({ code: 'http:not_found', details: { route: ctx.req.url } });
  });

  app.onError((err, ctx) =>
    protectPrivateDeliveryFailureResponse(ctx.req.path, errorMiddleware({ isDevelopment: env.NODE_ENV !== 'production' })(err, ctx)),
  );

  return app;
}
