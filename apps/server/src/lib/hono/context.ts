import type { HonoEnv, MembershipContext, SessionUser } from '@nibleaf/core';
import { getContext } from 'hono/context-storage';
import { AppError } from '@/errors';

export type { HonoEnv };

export const getContextUserOrThrow = (): SessionUser => {
  const user = getContext<HonoEnv>().var.user;
  if (!user) {
    throw new AppError({ code: 'auth:no_user', message: 'Authentication required.' });
  }
  return user;
};

export const getContextOrganizationIdOrThrow = (): string => {
  const orgId = getContext<HonoEnv>().var.organizationId;
  if (!orgId) {
    throw new AppError({ code: 'http:bad_request', message: 'No active workspace in context.' });
  }
  return orgId;
};

export const getContextMembership = () => getContext<HonoEnv>().var.membership;

export const getContextMembershipOrThrow = (): MembershipContext => {
  const membership = getContext<HonoEnv>().var.membership;
  if (!membership) {
    throw new AppError({ code: 'auth:insufficient_role', message: 'Not a member of this workspace.' });
  }
  return membership;
};

export const getContextLocale = () => getContext<HonoEnv>().var.locale;
