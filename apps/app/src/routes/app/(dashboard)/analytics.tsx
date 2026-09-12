import { createFileRoute } from '@tanstack/react-router';
import { DashboardAnalyticsPage } from '@/features/analytics';

export const Route = createFileRoute('/app/(dashboard)/analytics')({
  component: DashboardAnalyticsPage,
});
