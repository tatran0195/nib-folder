import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import ProjectPreviewPage from '@/features/project/ProjectPreviewPage';

export const Route = createFileRoute('/app/projects/$projectId/preview')({
  component: ProjectPreviewRoute,
  validateSearch: (search) =>
    z
      .object({
        branchId: z.string().min(1).optional().catch(undefined),
        languageId: z.string().min(1).optional().catch(undefined),
        pageId: z.string().min(1).optional().catch(undefined),
      })
      .parse(search),
});

function ProjectPreviewRoute() {
  const { projectId } = Route.useParams();
  const { branchId, languageId, pageId } = Route.useSearch();
  return <ProjectPreviewPage branchId={branchId} languageId={languageId} pageId={pageId} projectId={projectId} />;
}
