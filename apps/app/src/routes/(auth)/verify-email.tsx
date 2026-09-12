import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AuthVerifyEmailPage } from '@/features/auth';

export const Route = createFileRoute('/(auth)/verify-email')({
  validateSearch: (search) =>
    z
      .object({
        email: z.string().optional().catch(undefined),
        token: z.string().optional().catch(undefined),
        invite: z.string().optional().catch(undefined),
        delivery: z.enum(['sent', 'failed']).optional().catch(undefined),
      })
      .parse(search),
  head: () => ({ meta: [{ title: 'Verify email — Nibleaf' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: VerifyEmailRoute,
});

function VerifyEmailRoute() {
  const search = Route.useSearch();
  return <AuthVerifyEmailPage delivery={search.delivery} email={search.email} invite={search.invite} token={search.token} />;
}
