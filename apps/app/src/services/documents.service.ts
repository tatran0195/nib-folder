import {
  type AiDraftBody,
  type CreateBranchBody,
  type CreateCommentBody,
  type CreateLanguageBody,
  type CreatePageBody,
  inferSafeInlineAssetContentType,
  type ReorderPagesBody,
  type UpdateLanguageBody,
  type UpdatePageBody,
} from '@nibleaf/validators';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { getData, mutateData } from './client-helpers';
import { queryKeys } from './queryKeys';
import type { Asset, Branch, Comment, Language, Page, PageNode } from './types';

const requireQueryValue = (value: string | undefined, label: string) => {
  if (!value) {
    throw new Error(`${label} is required`);
  }
  return value;
};

// ─── Pages ──────────────────────────────────────────────────────────────────

export const usePages = (projectId: string | undefined, languageId?: string, branchId?: string) =>
  useQuery({
    queryKey: queryKeys.pages.all(projectId ?? '', languageId, branchId),
    enabled: Boolean(projectId),
    queryFn: async () =>
      getData<PageNode[]>(
        await api.app.projects[':projectId'].pages.$get({
          param: { projectId: requireQueryValue(projectId, 'Project ID') },
          query: { ...(languageId ? { languageId } : {}), ...(branchId ? { branchId } : {}) },
        }),
        'pages',
      ),
  });

export const usePage = (projectId: string | undefined, pageId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.pages.detail(projectId ?? '', pageId ?? ''),
    enabled: Boolean(projectId && pageId),
    queryFn: async () =>
      getData<Page>(
        await api.app.projects[':projectId'].pages[':id'].$get({
          param: { projectId: requireQueryValue(projectId, 'Project ID'), id: requireQueryValue(pageId, 'Page ID') },
        }),
        'page',
      ),
  });

export const useCreatePage = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreatePageBody) =>
      mutateData<Page>(await api.app.projects[':projectId'].pages.$post({ param: { projectId }, json: body }), 'Could not create the page.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pages.allForProject(projectId) }),
  });
};

export const useUpdatePage = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, body }: { pageId: string; body: UpdatePageBody }) =>
      mutateData<Page>(
        await api.app.projects[':projectId'].pages[':id'].$patch({ param: { projectId, id: pageId }, json: body }),
        'Could not save the page.',
      ),
    onSuccess: (_data, { pageId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.pages.allForProject(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.pages.detail(projectId, pageId) });
    },
  });
};

export const useDeletePage = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pageId: string) =>
      mutateData(await api.app.projects[':projectId'].pages[':id'].$delete({ param: { projectId, id: pageId } }), 'Could not delete the page.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pages.allForProject(projectId) }),
  });
};

export const useReorderPages = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ReorderPagesBody) =>
      mutateData(await api.app.projects[':projectId'].pages.reorder.$post({ param: { projectId }, json: body }), 'Could not reorder pages.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pages.allForProject(projectId) }),
  });
};

// ─── Languages ───────────────────────────────────────────────────────────────

export const useLanguages = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.languages.all(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async () =>
      getData<Language[]>(
        await api.app.projects[':projectId'].languages.$get({ param: { projectId: requireQueryValue(projectId, 'Project ID') } }),
        'languages',
      ),
  });

export const useCreateLanguage = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateLanguageBody) =>
      mutateData<Language>(await api.app.projects[':projectId'].languages.$post({ param: { projectId }, json: body }), 'Could not add the language.'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.languages.all(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.pages.allForProject(projectId) });
    },
  });
};

export const useUpdateLanguage = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateLanguageBody }) =>
      mutateData<Language>(
        await api.app.projects[':projectId'].languages[':id'].$patch({ param: { projectId, id }, json: body }),
        'Could not update the language.',
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.languages.all(projectId) }),
  });
};

export const useDeleteLanguage = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      mutateData(await api.app.projects[':projectId'].languages[':id'].$delete({ param: { projectId, id } }), 'Could not delete the language.'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.languages.all(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.pages.allForProject(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
};

// ─── Branches ────────────────────────────────────────────────────────────────

export const useBranches = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.branches.all(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async () =>
      getData<Branch[]>(
        await api.app.projects[':projectId'].branches.$get({ param: { projectId: requireQueryValue(projectId, 'Project ID') } }),
        'branches',
      ),
  });

export const useCreateBranch = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateBranchBody) =>
      mutateData(await api.app.projects[':projectId'].branches.$post({ param: { projectId }, json: body }), 'Could not create the branch.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.branches.all(projectId) }),
  });
};

export const useMergeBranch = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      mutateData(await api.app.projects[':projectId'].branches[':id'].merge.$post({ param: { projectId, id } }), 'Could not merge the branch.'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.branches.all(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.pages.allForProject(projectId) });
    },
  });
};

// ─── Comments ───────────────────────────────────────────────────────────────

export const useComments = (projectId: string | undefined, pageId?: string) =>
  useQuery({
    queryKey: queryKeys.comments.all(projectId ?? '', pageId),
    enabled: Boolean(projectId),
    queryFn: async () =>
      getData<Comment[]>(
        await api.app.projects[':projectId'].comments.$get({
          param: { projectId: requireQueryValue(projectId, 'Project ID') },
          query: pageId ? { pageId } : {},
        }),
        'comments',
      ),
  });

export const useCreateComment = (projectId: string, pageId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCommentBody) =>
      mutateData<Comment>(await api.app.projects[':projectId'].comments.$post({ param: { projectId }, json: body }), 'Could not post the comment.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.comments.all(projectId, pageId) }),
  });
};

export const useResolveComment = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) =>
      mutateData<Comment>(
        await api.app.projects[':projectId'].comments[':id'].$patch({ param: { projectId, id }, json: { resolved } }),
        'Could not update the comment.',
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', projectId] }),
  });
};

export const useDeleteComment = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      mutateData(await api.app.projects[':projectId'].comments[':id'].$delete({ param: { projectId, id } }), 'Could not delete the comment.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', projectId] }),
  });
};

// ─── AI drafting assistant ───────────────────────────────────────────────────

export const useAiDraft = (projectId: string) =>
  useMutation({
    mutationFn: async (body: AiDraftBody) =>
      mutateData(await api.app.projects[':projectId'].ai.$post({ param: { projectId }, json: body }), 'Could not draft content.'),
  });

// ─── Assets ─────────────────────────────────────────────────────────────────

/** Browsers occasionally omit File.type for valid images; never infer an active type. */
const uploadContentType = (file: File): string => file.type.trim() || inferSafeInlineAssetContentType(file.name) || 'application/octet-stream';

/** Presign → PUT bytes → confirm. Returns the recorded asset. */
export const useUploadAsset = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<Asset> => {
      const contentType = uploadContentType(file);
      const presign = await mutateData(
        await api.app.projects[':projectId'].assets.presign.$post({
          param: { projectId },
          json: { filename: file.name, contentType, size: file.size },
        }),
        'Could not start the upload.',
      );
      const put = await fetch(presign.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } });
      if (!put.ok) {
        throw new Error('Upload failed.');
      }
      return mutateData(
        await api.app.projects[':projectId'].assets.confirm.$post({
          param: { projectId },
          json: { key: presign.key, contentType, size: file.size },
        }),
        'Could not finalize the upload.',
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.assets.all(projectId) }),
  });
};
