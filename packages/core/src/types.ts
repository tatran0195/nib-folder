import type { Locale } from '@nibleaf/i18n/locales';
import type { MemberRole } from '@nibleaf/shared/constants';
import type { RequestIdVariables } from 'hono/request-id';

export interface SessionUser {
  email: string;
  id: string;
  image?: string | null;
  name: string;
}

export interface AuthSession {
  activeOrganizationId?: string | null;
  expiresAt: Date;
  id: string;
  userId: string;
}

export interface ApiKeyContext {
  id: string;
  projectId: string;
  scopes: string[];
}

export interface ProjectContext {
  id: string;
  name: string;
  organizationId: string;
}

export interface MembershipContext {
  organizationId: string;
  role: MemberRole;
}

export type HonoVariables = RequestIdVariables & {
  user: SessionUser | null;
  session: AuthSession | null;
  organizationId: string | null;
  project: ProjectContext | null;
  membership: MembershipContext | null;
  apiKey: ApiKeyContext | null;
  locale: Locale;
};

export interface HonoEnv {
  Variables: HonoVariables;
}
