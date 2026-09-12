import type { SiteShell } from '@/hooks/api/types';
import { QueryProvider } from '@/integrations/tanstack-query/root-provider';
import { SiteChrome } from './components/SiteChrome';

export interface SiteReaderPageProps {
  projectId: string;
  lang?: string;
  site: SiteShell | null;
}

export function SiteReaderPage({ projectId, lang, site }: SiteReaderPageProps) {
  return (
    <QueryProvider>
      <SiteChrome projectId={projectId} lang={lang} site={site} />
    </QueryProvider>
  );
}
