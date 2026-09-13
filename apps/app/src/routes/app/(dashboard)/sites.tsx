import { createFileRoute } from '@tanstack/react-router';
import DashboardSitesPage from '@/features/dashboard/DashboardSitesPage';

export const Route = createFileRoute('/app/(dashboard)/sites')({
  validateSearch: (search: Record<string, unknown>): { newSite?: boolean } =>
    search.newSite === true || search.newSite === 'true' ? { newSite: true } : {},
  ssr: false,
  component: DashboardSitesRoute,
});

function DashboardSitesRoute() {
  const { newSite } = Route.useSearch();
  return <DashboardSitesPage newSite={newSite} />;
}
