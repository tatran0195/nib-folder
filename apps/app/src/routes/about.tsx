import { createFileRoute } from '@tanstack/react-router';
import { MarketingAboutPage } from '@/features/marketing';
import { breadcrumbLd, canonicalHref, getGithubStarsFn, pageMeta } from '@/lib/marketing-seo';

export { MarketingAboutPage as AboutPage } from '@/features/marketing';

export const Route = createFileRoute('/about')({
  loader: async () => ({ stars: await getGithubStarsFn() }),
  head: () => ({
    meta: pageMeta({
      title: 'About Nibleaf: documentation ownership and Arabic support',
      description:
        'Why Nibleaf exists: a Markdown-based, Arabic-ready documentation platform for teams that want portable content and a clear publishing workflow.',
      path: '/about',
    }),
    links: [{ rel: 'canonical', href: canonicalHref('/about') }],
    scripts: [
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'About', path: '/about' },
      ]),
    ],
  }),
  component: AboutRoute,
});

function AboutRoute() {
  const { stars } = Route.useLoaderData();
  return <MarketingAboutPage stars={stars} />;
}
