import type { MarkNotificationsReadBody, UpdateWorkspaceSettingsBody } from '@nibleaf/validators';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { getData, mutateData } from './client-helpers';
import { queryKeys } from './queryKeys';
import type { NotificationList, WorkspaceSettings } from './types';

/** Workspace/site operational settings. Pass a projectId to read the SITE's own
 *  org settings (each site is its own workspace); omit it for the account view. */
export const useWorkspaceSettings = (projectId?: string) =>
  useQuery({
    queryKey: projectId ? queryKeys.workspace.projectSettings(projectId) : queryKeys.workspace.settings(),
    queryFn: async () =>
      projectId
        ? getData<WorkspaceSettings>(await api.app.projects[':projectId'].settings.$get({ param: { projectId } }), 'site settings')
        : getData<WorkspaceSettings>(await api.app.workspace.$get(), 'workspace settings'),
  });

/** Update workspace/site settings. Pass a projectId to write the SITE's own org
 *  settings (per-site workspace); omit it for the account view. */
export const useUpdateWorkspaceSettings = (projectId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateWorkspaceSettingsBody) =>
      projectId
        ? mutateData<WorkspaceSettings>(
            await api.app.projects[':projectId'].settings.$patch({ param: { projectId }, json: body }),
            'Could not update settings.',
          )
        : mutateData<WorkspaceSettings>(await api.app.workspace.$patch({ json: body }), 'Could not update workspace settings.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectId ? queryKeys.workspace.projectSettings(projectId) : queryKeys.workspace.settings() }),
  });
};

// ─── Notifications (bell inbox) ──────────────────────────────────────────────

/** The first inbox page (newest 50). Pass `enabled: false` until the popover opens. */
export const useNotifications = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: queryKeys.notifications.list(),
    enabled: options?.enabled ?? true,
    queryFn: async () => getData<NotificationList>(await api.app.notifications.$get({ query: {} }), 'notifications'),
  });

/** Unread badge count for the header bell. Polls every 60s. */
export const useUnreadNotificationCount = () =>
  useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    refetchInterval: 60_000,
    queryFn: async () => getData(await api.app.notifications['unread-count'].$get(), 'notifications'),
  });

/** Mark notifications read — pass `{ ids }` for specific rows or `{ all: true }`. */
export const useMarkNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: MarkNotificationsReadBody) =>
      mutateData(await api.app.notifications.read.$post({ json: body }), 'Could not update notifications.'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    },
  });
};
