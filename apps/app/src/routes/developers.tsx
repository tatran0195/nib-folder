import { createFileRoute } from '@tanstack/react-router';
import { MarketingDevelopersPage } from '@/features/marketing';
import { breadcrumbLd, canonicalHref, getGithubStarsFn, pageMeta } from '@/lib/marketing-seo';

export { MarketingDevelopersPage as DeveloperResourcesPage } from '@/features/marketing';

export const Route = createFileRoute('/developers')({
  loader: async () => ({ stars: await getGithubStarsFn() }),
  head: () => ({
    meta: pageMeta({
      title: 'Nibleaf developer resources: OpenAPI, agents, and CLI',
      description:
        'Discover the Nibleaf public reader API, OpenAPI schema, Markdown content negotiation, llms files, authentication boundaries, and official CLI.',
      path: '/developers',
    }),
    links: [{ rel: 'canonical', href: canonicalHref('/developers') }],
    scripts: [
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'Developer resources', path: '/developers' },
      ]),
    ],
  }),
  component: DeveloperRoute,
});

function DeveloperRoute() {
  const { stars } = Route.useLoaderData();
  return <MarketingDevelopersPage stars={stars} />;
}
