import type { ReactNode } from 'react';
import { ArticlePage } from '@/components/marketing/blog';
import type { BlogEntry } from '@/lib/blog';

export interface MarketingArticlePageProps {
  entry: BlogEntry;
  stars?: number;
  children: ReactNode;
}

export function MarketingArticlePage({ entry, stars = 0, children }: MarketingArticlePageProps) {
  return (
    <ArticlePage entry={entry} stars={stars}>
      {children}
    </ArticlePage>
  );
}
