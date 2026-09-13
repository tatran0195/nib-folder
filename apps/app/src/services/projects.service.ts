import { useT } from '@nibleaf/i18n/react';
import type { ResolvedTheme, ThemeConfigChange, ThemeTemplateV1 } from '@nibleaf/shared/themes';
import {
  type AddDomainBody,
  type CreateApiKeyBody,
  type CreateAudienceBody,
  type CreateProjectBody,
  type InviteReaderBody,
  type JwtAccessConfigBody,
  type MintlifyImportBody,
  type ProjectAccessModeBody,
  type ProjectConfigUpdate,
  type RotateApiKeyBody,
  searchConfigurationResultSchema,
  searchIndexDiagnosticsResultSchema,
  type UpdateProjectAddonBody,
  type UpdateProjectBody,
  type UpdateProjectSearchConfigurationBody,
  type UpsertOpenApiBody,
  updateProjectSearchConfigurationBody,
} from '@nibleaf/validators';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { ApiResponseError, getData, mutateData } from './client-helpers';
import { queryKeys } from './queryKeys';
import type { ApiKey, ApiKeySecret, Domain, OpenApiConfiguration, Project, ProjectAddon } from './types';

export interface ProjectThemeImportResult {
  applied: boolean;
  mode: 'merge' | 'replace';
  migratedFrom?: 0;
  changes: ThemeConfigChange[];
  theme: ResolvedTheme;
  template: ThemeTemplateV1;
  publishedChangesPending: boolean;
}

/** Summary returned by the content importers (Mintlify, Ghost, …). */
export interface ContentImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  assetsImported?: number;
  assetsSkipped?: number;
  warnings: string[];
}

export interface ReaderAccessData {
  accessMode: 'PUBLIC' | 'WORKSPACE' | 'READERS';
  readers: Array<{
    id: string;
    email: string | null;
    name: string | null;
    status: string;
    audiences: Array<{ audience: { id: string; name: string } }>;
    _count: { sessions: number };
  }>;
  audiences: Array<{
    id: string;
    name: string;
    grants: Array<{ pageId: string | null }>;
    _count: { readers: number };
  }>;
  jwt: {
    enabled: boolean;
    issuer: string;
    audience: string;
    jwksUrl: string | null;
    publicJwks: unknown;
    groupsClaim: string;
    claimMapping: unknown;
    sessionTtlMinutes: number;
    maxTokenAgeSeconds: number;
    clockToleranceSecs: number;
  } | null;
  audit: Array<{ id: string; action: string; createdAt: string }>;
}

const requireQueryValue = (value: string | undefined, label: string) => {
  if (!value) {
    throw new Error(`${label} is required`);
  }
  return value;
};

// ─── Projects Queries ────────────────────────────────────────────────────────

export const useProjects = () =>
  useQuery({
    queryKey: queryKeys.projects.all(),
    queryFn: async () => getData<Project[]>(await api.app.projects.$get(), 'documentation sites'),
  });

export const useProject = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.projects.detail(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async () =>
      getData<Project>(await api.app.projects[':id'].$get({ param: { id: requireQueryValue(projectId, 'Project ID') } }), 'project'),
  });

export const useProjectAddons = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.addons.all(projectId),
    queryFn: async () => getData<ProjectAddon[]>(await api.app.projects[':projectId'].addons.$get({ param: { projectId } }), 'project add-ons'),
  });

export const useApiKeys = (projectId: string | undefined) => {
  const t = useT();
  return useQuery({
    queryKey: queryKeys.apiKeys.all(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async () =>
      getData<ApiKey[]>(
        await api.app.projects[':projectId']['api-keys'].$get({ param: { projectId: requireQueryValue(projectId, 'Project ID') } }),
        t('settings.apiKeys.title'),
      ),
  });
};

export const useDomains = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.domains.all(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async () =>
      getData<Domain[]>(
        await api.app.projects[':projectId'].domains.$get({ param: { projectId: requireQueryValue(projectId, 'Project ID') } }),
        'domains',
      ),
  });

export const useOpenApiConfiguration = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.openapi.detail(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async () =>
      getData<OpenApiConfiguration | null>(
        await api.app.projects[':projectId'].openapi.$get({ param: { projectId: requireQueryValue(projectId, 'Project ID') } }),
        'OpenAPI configuration',
      ),
  });

// ─── Projects Mutations ──────────────────────────────────────────────────────

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateProjectBody) => mutateData<Project>(await api.app.projects.$post({ json: body }), 'Could not create the site.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects.all() }),
  });
};

export const useUpdateProject = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateProjectBody) =>
      mutateData<Project>(await api.app.projects[':id'].$patch({ param: { id: projectId }, json: body }), 'Could not update the site.'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
};

export const useUpdateProjectConfig = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ config, icon }: { config: ProjectConfigUpdate; icon?: string | null }) =>
      mutateData<Project>(
        await api.app.projects[':id'].$patch({ param: { id: projectId }, json: icon === undefined ? { config } : { config, icon } }),
        'Could not update the site configuration.',
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
};

export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) =>
      mutateData(await api.app.projects[':id'].$delete({ param: { id: projectId } }), 'Could not delete the site.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects.all() }),
  });
};

// ─── API Keys Mutations ──────────────────────────────────────────────────────

export const useCreateApiKey = (projectId: string) => {
  const queryClient = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: async (body: CreateApiKeyBody) =>
      mutateData<ApiKeySecret>(
        await api.app.projects[':projectId']['api-keys'].$post({ param: { projectId }, json: body }),
        t('settings.apiKeys.createError'),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all(projectId) }),
  });
};

export const useRotateApiKey = (projectId: string) => {
  const queryClient = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: RotateApiKeyBody }) =>
      mutateData<ApiKeySecret>(
        await api.app.projects[':projectId']['api-keys'][':id'].rotate.$post({ param: { projectId, id }, json: body }),
        t('settings.apiKeys.rotateError'),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all(projectId) }),
  });
};

export const useRevokeApiKey = (projectId: string) => {
  const queryClient = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: async (id: string) =>
      mutateData<ApiKey>(
        await api.app.projects[':projectId']['api-keys'][':id'].$delete({ param: { projectId, id } }),
        t('settings.apiKeys.revokeError'),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all(projectId) }),
  });
};

// ─── Domains Mutations ───────────────────────────────────────────────────────

export const useAddDomain = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: AddDomainBody) =>
      mutateData(await api.app.projects[':projectId'].domains.$post({ param: { projectId }, json: body }), 'Could not add the domain.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.domains.all(projectId) }),
  });
};

export const useVerifyDomain = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      mutateData(await api.app.projects[':projectId'].domains[':id'].verify.$post({ param: { projectId, id } }), 'Could not verify.'),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.domains.all(projectId) }),
  });
};

export const useSetPrimaryDomain = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      mutateData(
        await api.app.projects[':projectId'].domains[':id'].primary.$post({ param: { projectId, id } }),
        'Could not set the primary domain.',
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.domains.all(projectId) }),
  });
};

export const useDeleteDomain = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      mutateData(await api.app.projects[':projectId'].domains[':id'].$delete({ param: { projectId, id } }), 'Could not remove the domain.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.domains.all(projectId) }),
  });
};

// ─── OpenAPI Mutations ───────────────────────────────────────────────────────

export const useUpsertOpenApi = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpsertOpenApiBody) =>
      mutateData(await api.app.projects[':projectId'].openapi.$put({ param: { projectId }, json: body }), 'Could not save the OpenAPI document.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.openapi.detail(projectId) }),
  });
};

export const useSyncOpenApi = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      mutateData(await api.app.projects[':projectId'].openapi.sync.$post({ param: { projectId } }), 'Could not refresh the OpenAPI document.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.openapi.detail(projectId) }),
  });
};

export const useDeleteOpenApi = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      mutateData(await api.app.projects[':projectId'].openapi.$delete({ param: { projectId } }), 'Could not remove the OpenAPI document.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.openapi.detail(projectId) }),
  });
};

// ─── Add-ons Mutations ───────────────────────────────────────────────────────

export const useUpdateProjectAddon = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ addonId, body }: { addonId: string; body: UpdateProjectAddonBody }) =>
      mutateData<ProjectAddon>(
        await api.app.projects[':projectId'].addons[':addonId'].$patch({ param: { projectId, addonId }, json: body }),
        'Could not update the add-on.',
      ),
    onSuccess: (addon) => {
      qc.setQueryData(queryKeys.addons.detail(projectId, addon.id), addon);
      qc.invalidateQueries({ queryKey: queryKeys.addons.all(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
    onError: async (error, variables) => {
      if (error instanceof ApiResponseError && error.code === 'addon:revision_conflict') {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.addons.detail(projectId, variables.addonId), exact: true, refetchType: 'all' }),
          qc.invalidateQueries({ queryKey: queryKeys.addons.all(projectId), exact: true, refetchType: 'all' }),
        ]);
      }
    },
  });
};

const useSetProjectAddonEnabled = (projectId: string, action: 'activate' | 'deactivate') => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ addonId, expectedRevision }: { addonId: string; expectedRevision: number }) => {
      const response =
        action === 'activate'
          ? await api.app.projects[':projectId'].addons[':addonId'].activate.$post({ param: { projectId, addonId }, json: { expectedRevision } })
          : await api.app.projects[':projectId'].addons[':addonId'].deactivate.$post({ param: { projectId, addonId }, json: { expectedRevision } });
      return mutateData<ProjectAddon>(response, action === 'activate' ? 'Could not enable the add-on.' : 'Could not disable the add-on.');
    },
    onSuccess: (addon) => {
      qc.setQueryData(queryKeys.addons.detail(projectId, addon.id), addon);
      qc.invalidateQueries({ queryKey: queryKeys.addons.all(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
    onError: async (error, variables) => {
      if (error instanceof ApiResponseError && error.code === 'addon:revision_conflict') {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.addons.detail(projectId, variables.addonId), exact: true, refetchType: 'all' }),
          qc.invalidateQueries({ queryKey: queryKeys.addons.all(projectId), exact: true, refetchType: 'all' }),
        ]);
      }
    },
  });
};

export const useActivateProjectAddon = (projectId: string) => useSetProjectAddonEnabled(projectId, 'activate');
export const useDeactivateProjectAddon = (projectId: string) => useSetProjectAddonEnabled(projectId, 'deactivate');

// ─── Theme Importers / Exporters ────────────────────────────────────────────

export const useExportProjectTheme = (projectId: string) =>
  useMutation({
    mutationFn: async () => getData(await api.app.projects[':id']['theme-template'].$get({ param: { id: projectId } }), 'theme template'),
  });

export const useImportProjectTheme = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ template, mode, apply }: { template: unknown; mode: 'merge' | 'replace'; apply: boolean }) =>
      mutateData(
        await api.app.projects[':id']['theme-template'].import.$post({
          param: { id: projectId },
          json: { template, mode, apply },
        }),
        apply ? 'Could not apply the theme template.' : 'Could not validate the theme template.',
      ),
    onSuccess: (_, variables) => {
      if (!variables.apply) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
};

// ─── Content Importers (Mintlify / Ghost) ───────────────────────────────────

export const useImportFromMintlify = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: MintlifyImportBody) =>
      mutateData(
        await api.app.projects[':projectId'].settings.import.mintlify.$post({ param: { projectId }, json: body }),
        'Could not import from Mintlify.',
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pages.allForProject(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
    },
  });
};

export const useImportFromGhost = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      mutateData(
        await api.app.projects[':projectId'].settings.import.ghost.$post({ param: { projectId }, json: body }),
        'Could not import from Ghost.',
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pages.allForProject(projectId) }),
  });
};

// ─── Project Search ─────────────────────────────────────────────────────────

export const useProjectSearchConfiguration = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.projectSearch.configuration(projectId),
    queryFn: async () =>
      searchConfigurationResultSchema.parse(
        await getData(await api.app.projects[':projectId'].settings.search.$get({ param: { projectId } }), 'search configuration'),
      ),
  });

export const useUpdateProjectSearchConfiguration = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateProjectSearchConfigurationBody) =>
      mutateData(
        await api.app.projects[':projectId'].settings.search.$patch({
          param: { projectId },
          json: updateProjectSearchConfigurationBody.parse(body),
        }),
        'Could not update search configuration.',
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.projectSearch.configuration(projectId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.site.shell(projectId) });
      queryClient.invalidateQueries({ queryKey: ['site', projectId, 'search'] });
    },
  });
};

export const useProjectSearchIndexDiagnostics = (projectId: string, cursor?: string, limit = 10) =>
  useQuery({
    queryKey: queryKeys.projectSearch.index(projectId, cursor, limit),
    queryFn: async () =>
      getData(
        await api.app.projects[':projectId'].settings.search.diagnostics.$get({
          param: { projectId },
          query: { limit: String(limit), ...(cursor ? { cursor } : {}) },
        }),
        'search index diagnostics',
      ).then((data) => searchIndexDiagnosticsResultSchema.parse(data)),
    refetchInterval: (query) => (query.state.data?.health === 'indexing' ? 2000 : false),
  });

export const useCreateProjectSearchReindex = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      mutateData(await api.app.projects[':projectId'].settings.search.reindex.$post({ param: { projectId } }), 'Could not queue search indexing.'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projectSearch.allIndex(projectId) }),
  });
};

// ─── Reader Access ──────────────────────────────────────────────────────────

export const useReaderAccess = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.readerAccess.detail(projectId),
    queryFn: async () =>
      getData<ReaderAccessData>(await api.app.projects[':projectId']['reader-access'].$get({ param: { projectId } }), 'reader access settings'),
  });

const useReaderAccessMutation = <TVariables, TResult>(projectId: string, mutationFn: (variables: TVariables) => Promise<TResult>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.readerAccess.detail(projectId) }),
  });
};

export const useUpdateReaderAccessMode = (projectId: string) =>
  useReaderAccessMutation(projectId, async (json: ProjectAccessModeBody) =>
    mutateData(
      await api.app.projects[':projectId']['reader-access'].mode.$put({ param: { projectId }, json }),
      'Could not update the reader access mode.',
    ),
  );

export const useCreateReaderAudience = (projectId: string) =>
  useReaderAccessMutation(projectId, async (json: CreateAudienceBody) =>
    mutateData(
      await api.app.projects[':projectId']['reader-access'].audiences.$post({ param: { projectId }, json }),
      'Could not create the reader audience.',
    ),
  );

export const useDeleteReaderAudience = (projectId: string) =>
  useReaderAccessMutation(projectId, async (audienceId: string) =>
    mutateData(
      await api.app.projects[':projectId']['reader-access'].audiences[':audienceId'].$delete({ param: { projectId, audienceId } }),
      'Could not delete the reader audience.',
    ),
  );

export const useInviteReader = (projectId: string) =>
  useReaderAccessMutation(projectId, async (json: InviteReaderBody) =>
    mutateData(
      await api.app.projects[':projectId']['reader-access'].readers.invite.$post({ param: { projectId }, json }),
      'Could not invite the reader.',
    ),
  );

export const useRevokeReader = (projectId: string) =>
  useReaderAccessMutation(projectId, async (readerId: string) =>
    mutateData(
      await api.app.projects[':projectId']['reader-access'].readers[':readerId'].revoke.$post({ param: { projectId, readerId } }),
      'Could not revoke the reader.',
    ),
  );

export const useUpdateReaderJwt = (projectId: string) =>
  useReaderAccessMutation(projectId, async (json: JwtAccessConfigBody) =>
    mutateData(
      await api.app.projects[':projectId']['reader-access'].jwt.$put({ param: { projectId }, json }),
      'Could not update the reader JWT configuration.',
    ),
  );

export const useTestReaderJwt = (projectId: string) =>
  useMutation({
    mutationFn: async (token: string) =>
      mutateData(
        await api.app.projects[':projectId']['reader-access'].jwt.test.$post({ param: { projectId }, json: { token } }),
        'Could not validate the reader JWT.',
      ),
  });

export const useEmergencyRevokeReaderAccess = (projectId: string) =>
  useReaderAccessMutation(projectId, async (_: undefined) =>
    mutateData(
      await api.app.projects[':projectId']['reader-access']['emergency-revoke'].$post({ param: { projectId } }),
      'Could not revoke reader access.',
    ),
  );
