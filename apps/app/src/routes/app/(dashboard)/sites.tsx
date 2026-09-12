import { createFileRoute } from '@tanstack/react-router';
import DashboardSitesPage from '@/features/dashboard/DashboardSitesPage';

export const Route = createFileRoute('/app/(dashboard)/sites')({
  component: DashboardSitesRoute,
  validateSearch: (search: Record<string, unknown>): { newSite?: boolean } =>
    search.newSite === true || search.newSite === 'true' ? { newSite: true } : {},
});

function DashboardSitesRoute() {
  const { newSite } = Route.useSearch();
  return <DashboardSitesPage newSite={newSite} />;
}
