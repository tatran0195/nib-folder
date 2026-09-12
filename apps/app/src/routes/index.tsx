import { createFileRoute } from '@tanstack/react-router';
import { MarketingHomePage } from '@/features/marketing';
import { breadcrumbLd, canonicalHref, getGithubStarsFn, pageMeta } from '@/lib/marketing-seo';

export const Route = createFileRoute('/')({
  loader: () => getGithubStarsFn(),
  head: () => ({
    meta: pageMeta({
      title: 'Nibleaf — the visual Markdown alternative to Mintlify',
      description:
        'A Notion-style docs editor over plain Markdown. Built-in search, 12 interface languages, first-class RTL, and first-party analytics. Free cloud beta or install the public AGPL-3.0 release.',
      path: '/',
    }),
    links: [
      { rel: 'canonical', href: canonicalHref('/') },
      { rel: 'alternate', hrefLang: 'en', href: canonicalHref('/') },
      { rel: 'alternate', hrefLang: 'ar', href: canonicalHref('/ar') },
      { rel: 'alternate', hrefLang: 'x-default', href: canonicalHref('/') },
    ],
    scripts: [
      breadcrumbLd([{ name: 'Home', path: '/' }]),
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Nibleaf',
          url: canonicalHref('/'),
        }),
      },
    ],
  }),
  component: IndexRoute,
});

function IndexRoute() {
  const stars = Route.useLoaderData();
  return <MarketingHomePage stars={stars} />;
}
