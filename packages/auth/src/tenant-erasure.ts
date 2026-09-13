import { createJob, QueueNames } from '@nibleaf/bullmq';
import { prisma } from '@nibleaf/database';

export class TenantErasureProjectNotFoundError extends Error {
  constructor() {
    super('Tenant project not found.');
    this.name = 'TenantErasureProjectNotFoundError';
  }
}

/** Single fail-closed tenant erasure workflow used by product and Better Auth
 * deletion paths. Queues search index cleanup then deletes the org (cascades
 * the project via FK). */
export const eraseProjectOrganization = async (organizationId: string, expectedProjectId?: string) => {
  const project = await prisma.project.findUnique({ where: { organizationId }, select: { id: true } });
  if (!project) {
    if (expectedProjectId) throw new TenantErasureProjectNotFoundError();
    await prisma.organization.delete({ where: { id: organizationId } });
    return { organizationId, projectId: null };
  }
  if (expectedProjectId && project.id !== expectedProjectId) throw new TenantErasureProjectNotFoundError();

  await createJob(QueueNames.SEARCH, { name: 'delete-project', data: { projectId: project.id } }, { jobId: `search-delete-${project.id}` });
  await prisma.organization.delete({ where: { id: organizationId } });
  return { organizationId, projectId: project.id };
};
