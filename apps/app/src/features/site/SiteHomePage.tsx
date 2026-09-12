import { SitePageView } from '@/components/site/site-page-view';
import type { SitePage } from '@/hooks/api/types';

export interface SiteHomePageProps {
  projectId: string;
  lang?: string;
  data: SitePage;
}

export function SiteHomePage({ projectId, lang, data }: SiteHomePageProps) {
  // Empty path resolves to the first page server-side.
  return <SitePageView projectId={projectId} lang={lang} data={data} />;
}
