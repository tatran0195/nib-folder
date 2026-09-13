import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import ProjectEditorPage from '@/features/editor/ProjectEditorPage';

export const Route = createFileRoute('/app/projects/$projectId/editor')({
  ssr: false,
  component: EditorRoute,
  validateSearch: (search) =>
    z
      .object({
        firstPublish: z.preprocess((value) => (value === true || value === 'true' || value === '1' ? true : undefined), z.literal(true).optional()),
        page: z.string().min(1).optional().catch(undefined),
        publish: z.preprocess((value) => (value === true || value === 'true' || value === '1' ? true : undefined), z.literal(true).optional()),
      })
      .parse(search),
});

function EditorRoute() {
  const { projectId } = Route.useParams();
  const { firstPublish, page: pageParam, publish: publishParam } = Route.useSearch();
  return <ProjectEditorPage firstPublish={firstPublish} pageIdParam={pageParam} projectId={projectId} publishParam={publishParam} />;
}
