import { PricingPage } from '@/components/marketing/pricing';

export interface MarketingPricingPageProps {
  stars?: number;
}

export function MarketingPricingPage({ stars = 0 }: MarketingPricingPageProps) {
  return <PricingPage stars={stars} />;
}
