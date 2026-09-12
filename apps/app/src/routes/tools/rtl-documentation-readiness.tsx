import { createFileRoute } from '@tanstack/react-router';
import { MarketingRtlReadinessPage } from '@/features/marketing';
import { breadcrumbLd, canonicalHref, getGithubStarsFn, pageMeta } from '@/lib/marketing-seo';

const TOOL_PATH = '/tools/rtl-documentation-readiness';

export const Route = createFileRoute('/tools/rtl-documentation-readiness')({
  loader: async () => ({ stars: await getGithubStarsFn() }),
  head: () => ({
    meta: pageMeta({
      title: 'Free RTL documentation readiness grader | Nibleaf',
      description:
        'Paste HTML and get a private, browser-only RTL documentation readiness report with transparent checks, unknowns, and reproduction steps.',
      path: TOOL_PATH,
    }),
    links: [{ rel: 'canonical', href: canonicalHref(TOOL_PATH) }],
    scripts: [
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'RTL documentation readiness grader', path: TOOL_PATH },
      ]),
    ],
  }),
  component: RtlDocumentationReadinessPage,
});

function RtlDocumentationReadinessPage() {
  const { stars } = Route.useLoaderData();
  return <MarketingRtlReadinessPage stars={stars} />;
}
