import { ComparePage } from '@/components/marketing/comparison-page';
import type { Comparison } from '@/lib/comparison-data';

export interface MarketingComparisonPageProps {
  data: Comparison;
  stars?: number;
}

export function MarketingComparisonPage({ data, stars = 0 }: MarketingComparisonPageProps) {
  return <ComparePage data={data} stars={stars} />;
}
