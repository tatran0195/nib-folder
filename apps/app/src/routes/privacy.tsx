import { createFileRoute } from '@tanstack/react-router';
import { MarketingPrivacyPage } from '@/features/marketing';
import { breadcrumbLd, canonicalHref, getGithubStarsFn, pageMeta } from '@/lib/marketing-seo';

export const Route = createFileRoute('/privacy')({
  loader: async () => ({ stars: await getGithubStarsFn() }),
  head: () => ({
    meta: pageMeta({
      title: 'Nibleaf Cloud Privacy Policy and Data Practices',
      description: 'How Nibleaf Cloud handles account and documentation data, analytics, subprocessors, retention, security, and deletion requests.',
      path: '/privacy',
    }),
    links: [{ rel: 'canonical', href: canonicalHref('/privacy') }],
    scripts: [
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'Privacy Policy', path: '/privacy' },
      ]),
    ],
  }),
  component: PrivacyRoute,
});

function PrivacyRoute() {
  const { stars } = Route.useLoaderData();
  return <MarketingPrivacyPage stars={stars} />;
}
