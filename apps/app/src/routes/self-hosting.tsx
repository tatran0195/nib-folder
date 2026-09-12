import { createFileRoute } from '@tanstack/react-router';
import { MarketingSelfHostingPage } from '@/features/marketing';
import { breadcrumbLd, canonicalHref, getGithubStarsFn, pageMeta } from '@/lib/marketing-seo';

export const Route = createFileRoute('/self-hosting')({
  loader: async () => ({ stars: await getGithubStarsFn() }),
  head: () => ({
    meta: pageMeta({
      title: 'Nibleaf self-hosting status and deployment architecture',
      description: 'Install Nibleaf with the public Docker Compose release, then configure DNS, TLS, backups, and monitoring for your environment.',
      path: '/self-hosting',
    }),
    links: [{ rel: 'canonical', href: canonicalHref('/self-hosting') }],
    scripts: [
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'Self-hosting', path: '/self-hosting' },
      ]),
    ],
  }),
  component: SelfHostingRoute,
});

function SelfHostingRoute() {
  const { stars } = Route.useLoaderData();
  return <MarketingSelfHostingPage stars={stars} />;
}
