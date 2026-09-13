import { createFileRoute } from '@tanstack/react-router';
import ProjectSettingsPage from '@/features/project/ProjectSettingsPage';
import { isProjectSectionId, type ProjectSectionId } from '@/features/project/project-settings-schema';

export const Route = createFileRoute('/app/projects/$projectId/settings')({
  validateSearch: (search: Record<string, unknown>): { section: ProjectSectionId } => ({
    section: isProjectSectionId(search.section) ? search.section : search.section === 'analytics' ? 'integrations' : 'general',
  }),
  ssr: false,
  component: ProjectSettingsRoute,
});

function ProjectSettingsRoute() {
  const { projectId } = Route.useParams();
  const { section } = Route.useSearch();
  return <ProjectSettingsPage projectId={projectId} section={section} />;
}
