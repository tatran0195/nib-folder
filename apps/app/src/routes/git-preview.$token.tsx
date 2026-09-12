import type { SiteSnapshot } from '@nibleaf/shared/site';
import { createFileRoute } from '@tanstack/react-router';
import { SiteGitPreviewPage } from '@/features/site';
import { getGitPreviewFn } from '@/functions/site';

export const Route = createFileRoute('/git-preview/$token')({
  loader: async ({ params }) => JSON.parse(await getGitPreviewFn({ data: { token: params.token } })) as { snapshot: SiteSnapshot },
  head: () => ({ meta: [{ title: 'Pull request preview · Nibleaf' }, { name: 'robots', content: 'noindex,nofollow' }] }),
  component: GitPreviewRoute,
});

function GitPreviewRoute() {
  const { snapshot } = Route.useLoaderData();
  return <SiteGitPreviewPage snapshot={snapshot} />;
}
