import { createFileRoute } from '@tanstack/react-router';
import ProjectAnalyticsPage from '@/features/analytics/ProjectAnalyticsPage';

export const Route = createFileRoute('/app/projects/$projectId/analytics')({
  component: ProjectAnalyticsRoute,
});

function ProjectAnalyticsRoute() {
  const { projectId } = Route.useParams();
  return <ProjectAnalyticsPage projectId={projectId} />;
}
