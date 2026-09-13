import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { answerSiteFn, searchSiteFn } from '@/functions/site-search';
import type { FirstPublishAttribution } from '@/lib/first-publish-activation';
import { api } from '@/services/api';
import { getData, mutateData } from './client-helpers';
import { queryKeys } from './queryKeys';
import type { Deployment } from './types';

export type SiteAnalyticsConsent = 'denied' | 'granted' | 'not_required' | 'unknown';
export type PublicAnalyticsPayload =
  | { name: 'page_view' | 'page_engaged'; path: string; language?: string; referrer?: string; engagementMs?: number; scrollDepth?: number }
  | {
      name: 'navigation_clicked' | 'cta_clicked' | 'outbound_link_clicked';
      path?: string;
      targetPath?: string;
      placement?: string;
      language?: string;
    }
  | { name: 'code_copied'; path?: string; placement?: string; language?: string }
  | { name: 'search_result_clicked'; path?: string; resultId?: string; resultPosition?: number; language?: string }
  | { name: 'feedback_submitted'; path?: string; feedback: 'helpful' | 'not_helpful'; target: 'page' };

export interface SiteAnalyticsEvent {
  eventId: string;
  occurredAt: string;
  consentState: SiteAnalyticsConsent;
  sessionId?: string;
  payload: PublicAnalyticsPayload;
}

const requireQueryValue = (value: string | undefined, label: string) => {
  if (!value) {
    throw new Error(`${label} is required`);
  }
  return value;
};

const requireSiteId = (siteId: string | undefined) => {
  if (!siteId) throw new Error('Site ID is required');
  return siteId;
};

// Publishing is async (worker builds the snapshot). Poll while a deployment is
// in flight so the dashboard transitions PENDING/BUILDING → READY/FAILED on its
// own instead of appearing stuck until a manual refresh.
const isInFlight = (status?: string): boolean => status === 'PENDING' || status === 'BUILDING';

export const useDeployments = (projectId: string | undefined, options?: { enabled?: boolean; pollIntervalMs?: number }) =>
  useQuery({
    queryKey: queryKeys.deployments.all(projectId ?? ''),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    queryFn: async () =>
      getData<Deployment[]>(
        await api.app.projects[':projectId'].deployments.$get({ param: { projectId: requireQueryValue(projectId, 'Project ID') } }),
        'deployments',
      ),
    refetchInterval: (query) => (query.state.data?.some((d) => isInFlight(d.status)) ? (options?.pollIntervalMs ?? 2500) : false),
  });

// What the next publish will change vs. the last deploy (Mintlify-style "show
// changes"). Cheap to recompute, and the editor autosaves constantly, so keep it
// fresh: refetch on mount/focus rather than trusting the default staleTime.
export const usePendingChanges = (projectId: string | undefined, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: queryKeys.deployments.changes(projectId ?? ''),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    staleTime: 0,
    queryFn: async () =>
      getData(
        await api.app.projects[':projectId'].deployments.changes.$get({ param: { projectId: requireQueryValue(projectId, 'Project ID') } }),
        'changes',
      ),
  });

export const usePublish = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ message, firstPublishAttribution }: { message?: string; firstPublishAttribution?: FirstPublishAttribution }) =>
      mutateData<Deployment>(
        await api.app.projects[':projectId'].deployments.$post({
          param: { projectId },
          json: { ...(message ? { message } : {}), ...(firstPublishAttribution ? { firstPublishAttribution } : {}) },
        }),
        'Could not publish.',
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deployments.all(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.deployments.latest(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.deployments.changes(projectId) });
    },
  });
};

export const usePublishAnyway = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      mutateData<Deployment>(
        await api.app.projects[':projectId'].deployments.$post({ param: { projectId }, json: { skipGrammarChecks: true } }),
        'Could not publish.',
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deployments.all(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.deployments.latest(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.deployments.changes(projectId) });
    },
  });
};

export const useRollback = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deploymentId: string) =>
      mutateData<Deployment>(
        await api.app.projects[':projectId'].deployments[':id'].rollback.$post({ param: { projectId, id: deploymentId } }),
        'Could not roll back.',
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deployments.all(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.deployments.latest(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.deployments.changes(projectId) });
    },
  });
};

export const useGetPublicMeta = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['public', 'meta'],
    enabled: options?.enabled ?? true,
    queryFn: async () => getData(await api.public.meta.$get(), 'public instance metadata'),
    staleTime: 5 * 60 * 1000,
  });

export const useGetInvitationInfo = (invitationId: string) =>
  useQuery({
    queryKey: ['public', 'invitations', invitationId],
    queryFn: async () => getData(await api.public.invitations[':id'].$get({ param: { id: invitationId } }), 'invitation'),
  });

export const useCreateSiteAnalyticsEvent = (projectId: string) =>
  useMutation({
    mutationFn: async (event: SiteAnalyticsEvent) => {
      const response = await api.public.sites[':id'].events.$post({ param: { id: projectId }, json: event });
      if (!response.ok) {
        throw new Error('Could not record the analytics event.');
      }
    },
  });

export const useSiteSearch = (siteId: string | undefined, query: string, language?: string, version?: string, limit?: number, enabled = true) =>
  useQuery({
    queryKey: queryKeys.site.search(siteId ?? '', query, language, version, limit),
    enabled: Boolean(enabled && siteId && query.trim()),
    queryFn: () =>
      searchSiteFn({
        data: {
          projectId: requireSiteId(siteId),
          query,
          ...(language ? { language } : {}),
          ...(version ? { version } : {}),
          ...(limit ? { limit } : {}),
        },
      }),
  });

export const useAnswerSite = () =>
  useMutation({
    mutationFn: (input: { projectId: string; query: string; language?: string; version?: string }) => answerSiteFn({ data: input }),
  });
