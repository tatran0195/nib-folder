import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createJob: vi.fn(),
  projectFindUnique: vi.fn(),
  organizationDelete: vi.fn(),
}));

vi.mock('@nibleaf/bullmq', () => ({ createJob: mocks.createJob, QueueNames: { SEARCH: 'search' } }));
vi.mock('@nibleaf/database', () => ({
  prisma: {
    project: { findUnique: mocks.projectFindUnique },
    organization: { delete: mocks.organizationDelete },
  },
}));

import { eraseProjectOrganization, TenantErasureProjectNotFoundError } from './tenant-erasure';

describe('shared tenant privacy erasure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectFindUnique.mockResolvedValue({ id: 'project-a' });
    mocks.createJob.mockResolvedValue(undefined);
    mocks.organizationDelete.mockResolvedValue({ id: 'org-a' });
  });

  it('queues search erasure, then deletes relational scope', async () => {
    await eraseProjectOrganization('org-a', 'project-a');
    expect(mocks.createJob).toHaveBeenCalledWith(
      'search',
      { name: 'delete-project', data: { projectId: 'project-a' } },
      { jobId: 'search-delete-project-a' },
    );
    expect(mocks.organizationDelete).toHaveBeenCalledWith({ where: { id: 'org-a' } });
    expect(mocks.createJob).toHaveBeenCalledBefore(mocks.organizationDelete);
  });

  it('throws TenantErasureProjectNotFoundError when expected project does not match', async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: 'other-project' });
    await expect(eraseProjectOrganization('org-a', 'project-a')).rejects.toBeInstanceOf(TenantErasureProjectNotFoundError);
    expect(mocks.createJob).not.toHaveBeenCalled();
    expect(mocks.organizationDelete).not.toHaveBeenCalled();
  });
});
