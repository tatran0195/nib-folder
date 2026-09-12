import { createFileRoute } from '@tanstack/react-router';
import { MarketingTermsPage } from '@/features/marketing';
import { breadcrumbLd, canonicalHref, getGithubStarsFn, pageMeta } from '@/lib/marketing-seo';

export const Route = createFileRoute('/terms')({
  loader: async () => ({ stars: await getGithubStarsFn() }),
  head: () => ({
    meta: pageMeta({
      title: 'Nibleaf Cloud Terms of Service and Acceptable Use',
      description:
        'Read the terms governing Nibleaf Cloud accounts, acceptable use, subscriptions, content ownership, service availability, and liability.',
      path: '/terms',
    }),
    links: [{ rel: 'canonical', href: canonicalHref('/terms') }],
    scripts: [
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'Terms of Service', path: '/terms' },
      ]),
    ],
  }),
  component: TermsRoute,
});

function TermsRoute() {
  const { stars } = Route.useLoaderData();
  return <MarketingTermsPage stars={stars} />;
}
