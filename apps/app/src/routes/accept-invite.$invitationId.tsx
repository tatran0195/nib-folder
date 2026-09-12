import { createFileRoute } from '@tanstack/react-router';
import { AuthAcceptInvitePage } from '@/features/auth';

export const Route = createFileRoute('/accept-invite/$invitationId')({
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: AcceptInviteRoute,
});

function AcceptInviteRoute() {
  const { invitationId } = Route.useParams();
  return <AuthAcceptInvitePage invitationId={invitationId} />;
}
