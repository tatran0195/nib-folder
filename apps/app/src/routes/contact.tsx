import { createFileRoute } from '@tanstack/react-router';
import { CONTACTS, MarketingContactPage } from '@/features/marketing';
import { NIBLEAF_ORGANIZATION } from '@/lib/marketing-organization';
import { breadcrumbLd, canonicalHref, getGithubStarsFn, pageMeta } from '@/lib/marketing-seo';

export const Route = createFileRoute('/contact')({
  loader: async () => ({ stars: await getGithubStarsFn() }),
  head: () => ({
    meta: pageMeta({
      title: 'Contact Nibleaf: support, privacy, security, and corrections',
      description:
        'Contact Nibleaf for product support, privacy requests, security disclosures, abuse reports, or corrections to our documentation articles.',
      path: '/contact',
    }),
    links: [{ rel: 'canonical', href: canonicalHref('/contact') }],
    scripts: [
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'Contact', path: '/contact' },
      ]),
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: 'Contact Nibleaf',
          url: canonicalHref('/contact'),
          mainEntity: {
            '@type': 'Organization',
            name: NIBLEAF_ORGANIZATION.name,
            url: canonicalHref('/'),
            address: NIBLEAF_ORGANIZATION.address,
            contactPoint: CONTACTS.map((contact) => ({
              '@type': 'ContactPoint',
              contactType: contact.title,
              email: contact.address,
              availableLanguage: ['English', 'Arabic'],
            })),
          },
        }),
      },
    ],
  }),
  component: ContactRoute,
});

function ContactRoute() {
  const { stars } = Route.useLoaderData();
  return <MarketingContactPage stars={stars} />;
}
