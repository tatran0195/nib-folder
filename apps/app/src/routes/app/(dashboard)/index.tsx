import { createFileRoute } from '@tanstack/react-router';
import DashboardProjectsPage from '@/features/dashboard/DashboardProjectsPage';

export const Route = createFileRoute('/app/(dashboard)/')({
  component: DashboardProjectsRoute,
  validateSearch: (search: Record<string, unknown>): { firstPublish?: boolean; newSite?: boolean } => ({
    ...(search.firstPublish === true || search.firstPublish === 'true' ? { firstPublish: true } : {}),
    ...(search.newSite === true || search.newSite === 'true' ? { newSite: true } : {}),
  }),
});

function DashboardProjectsRoute() {
  const { firstPublish, newSite } = Route.useSearch();
  return <DashboardProjectsPage firstPublish={firstPublish} newSite={newSite} />;
}
