import { lazy, Suspense } from 'react';
import { SitePageView } from '@/components/site/site-page-view';
import type { SitePage, SiteShell } from '@/hooks/api/types';

const OpenApiReferenceView = lazy(() =>
  import('@/components/site/openapi-reference-view').then((module) => ({ default: module.OpenApiReferenceView })),
);

export type SiteContentData =
  | { kind: 'openapi'; openapi: NonNullable<SiteShell['openapi']>; site: SiteShell; lang?: string; siteOrigin?: string }
  | { kind: 'page'; page: SitePage; lang?: string; version?: string; siteOrigin?: string };

export interface SiteContentPageProps {
  projectId: string;
  lang?: string;
  data: SiteContentData;
}

export function SiteContentPage({ projectId, lang, data }: SiteContentPageProps) {
  if (data.kind === 'openapi') {
    return (
      <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading API reference…</div>}>
        <OpenApiReferenceView projectId={projectId} />
      </Suspense>
    );
  }
  return <SitePageView projectId={projectId} lang={lang} data={data.page} />;
}
