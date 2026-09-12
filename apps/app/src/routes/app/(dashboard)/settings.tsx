import { createFileRoute } from '@tanstack/react-router';
import SettingsPage, { type SettingsTabValue } from '@/features/settings/SettingsPage';

const isTabValue = (value: unknown): value is SettingsTabValue => value === 'account' || value === 'appearance';

export const Route = createFileRoute('/app/(dashboard)/settings')({
  component: DashboardSettingsRoute,
  validateSearch: (search: Record<string, unknown>): { tab: SettingsTabValue } => ({
    tab: isTabValue(search.tab) ? search.tab : 'account',
  }),
});

function DashboardSettingsRoute() {
  const { tab } = Route.useSearch();
  return <SettingsPage tab={tab} />;
}
