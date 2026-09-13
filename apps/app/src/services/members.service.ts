import type { InviteMemberBody, TransferOwnershipBody, UpdateMemberRoleBody } from '@nibleaf/validators';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { getData, mutateData } from './client-helpers';
import { queryKeys } from './queryKeys';

const requireQueryValue = (value: string | undefined, label: string) => {
  if (!value) {
    throw new Error(`${label} is required`);
  }
  return value;
};

export const useMembers = () =>
  useQuery({
    queryKey: queryKeys.members.all(),
    queryFn: async () => getData(await api.app.members.$get(), 'members'),
  });

/** Members + pending invitations for a single site (its own organization). */
export const useProjectMembers = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.members.forProject(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async () =>
      getData(await api.app.projects[':projectId'].members.$get({ param: { projectId: requireQueryValue(projectId, 'Project ID') } }), 'members'),
  });

export const useInviteMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: InviteMemberBody) => mutateData(await api.app.members.invite.$post({ json: body }), 'Could not send the invite.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.all() }),
  });
};

export const useUpdateMemberRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateMemberRoleBody }) =>
      mutateData(await api.app.members[':id'].role.$patch({ param: { id }, json: body }), 'Could not update the role.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.all() }),
  });
};

export const useRemoveMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => mutateData(await api.app.members[':id'].$delete({ param: { id } }), 'Could not remove the member.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.all() }),
  });
};

// ─── Per-site members (each site owns its own people/roles) ──────────────────

export const useInviteProjectMember = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: InviteMemberBody) =>
      mutateData(await api.app.projects[':projectId'].members.invite.$post({ param: { projectId }, json: body }), 'Could not send the invite.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.forProject(projectId) }),
  });
};

export const useUpdateProjectMemberRole = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateMemberRoleBody }) =>
      mutateData(
        await api.app.projects[':projectId'].members[':id'].role.$patch({ param: { projectId, id }, json: body }),
        'Could not update the role.',
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.forProject(projectId) }),
  });
};

export const useTransferProjectOwnership = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: TransferOwnershipBody) =>
      mutateData(
        await api.app.projects[':projectId'].members['transfer-ownership'].$post({ param: { projectId }, json: body }),
        'Could not transfer ownership.',
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.forProject(projectId) }),
  });
};

export const useRemoveProjectMember = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      mutateData(await api.app.projects[':projectId'].members[':id'].$delete({ param: { projectId, id } }), 'Could not remove the member.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.forProject(projectId) }),
  });
};

export const useCancelProjectInvitation = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      mutateData(
        await api.app.projects[':projectId'].members.invitations[':id'].$delete({ param: { projectId, id } }),
        'Could not revoke the invitation.',
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.forProject(projectId) }),
  });
};
