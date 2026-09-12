import { createFileRoute } from '@tanstack/react-router';
import ProjectOverviewPage from '@/features/project/ProjectOverviewPage';

export const Route = createFileRoute('/app/projects/$projectId/')({
  component: ProjectOverviewRoute,
});

function ProjectOverviewRoute() {
  const { projectId } = Route.useParams();
  return <ProjectOverviewPage projectId={projectId} />;
}
