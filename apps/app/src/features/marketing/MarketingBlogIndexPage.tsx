import { BlogIndexPage } from '@/components/marketing/blog';
import type { BlogEntry } from '@/lib/blog';

export interface MarketingBlogIndexPageProps {
  entries: BlogEntry[];
  stars?: number;
}

export function MarketingBlogIndexPage({ entries, stars = 0 }: MarketingBlogIndexPageProps) {
  return <BlogIndexPage entries={entries} stars={stars} />;
}
