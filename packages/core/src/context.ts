import type { Locale } from '@nibleaf/i18n/locales';
import { AppError } from '@nibleaf/shared';
import type { Context } from 'hono';
import type { ApiKeyContext, AuthSession, HonoEnv, MembershipContext, ProjectContext, SessionUser } from './types';

/**
 * Explicit, strongly-typed execution context passed as the first argument to all domain services.
 * Decouples business logic from HTTP transports and removes hidden AsyncLocalStorage dependencies.
 */
export interface ServiceContext {
  user: SessionUser | null;
  session: AuthSession | null;
  organizationId: string | null;
  project: ProjectContext | null;
  membership: MembershipContext | null;
  apiKey: ApiKeyContext | null;
  locale: Locale;
  requestId?: string;
}

/**
 * Extracts a typed ServiceContext from a Hono request.
 */
export function getServiceContext(c: Context<HonoEnv>): ServiceContext {
  const vars = c.var;
  return {
    user: vars.user ?? null,
    session: vars.session ?? null,
    organizationId: vars.organizationId ?? null,
    project: vars.project ?? null,
    membership: vars.membership ?? null,
    apiKey: vars.apiKey ?? null,
    locale: vars.locale ?? 'en',
    requestId: vars.requestId,
  };
}

/**
 * Asserts that the context contains an authenticated user.
 */
export function requireUser(ctx: ServiceContext): SessionUser {
  if (!ctx.user) {
    throw new AppError({ code: 'auth:no_user', message: 'Authentication required.' });
  }
  return ctx.user;
}

/**
 * Asserts that the context contains an active workspace/organization.
 */
export function requireOrganizationId(ctx: ServiceContext): string {
  if (!ctx.organizationId) {
    throw new AppError({ code: 'http:bad_request', message: 'No active workspace in context.' });
  }
  return ctx.organizationId;
}

/**
 * Asserts that the context contains an active resolved project.
 */
export function requireProject(ctx: ServiceContext): ProjectContext {
  if (!ctx.project) {
    throw new AppError({ code: 'http:not_found', message: 'Project not found or not accessible.' });
  }
  return ctx.project;
}

/**
 * Asserts that the context contains an active membership.
 */
export function requireMembership(ctx: ServiceContext): MembershipContext {
  if (!ctx.membership) {
    throw new AppError({ code: 'auth:insufficient_role', message: 'Not a member of this workspace.' });
  }
  return ctx.membership;
}
