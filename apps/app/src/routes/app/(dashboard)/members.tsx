import { createFileRoute } from '@tanstack/react-router';
import MembersPage from '@/features/members/MembersPage';

export const Route = createFileRoute('/app/(dashboard)/members')({
  component: MembersPage,
});
