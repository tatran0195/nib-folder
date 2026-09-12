import { AlternativesPage } from '@/components/marketing/comparison-page';
import type { AlternativesRoundup } from '@/lib/comparison-data';

export interface MarketingAlternativesPageProps {
  data: AlternativesRoundup;
  stars?: number;
}

export function MarketingAlternativesPage({ data, stars = 0 }: MarketingAlternativesPageProps) {
  return <AlternativesPage data={data} stars={stars} />;
}
