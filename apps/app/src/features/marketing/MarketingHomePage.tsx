import { LandingPage } from '@/components/cloud-marketing';

export interface MarketingHomePageProps {
  stars?: number;
}

export function MarketingHomePage({ stars = 0 }: MarketingHomePageProps) {
  return <LandingPage stars={stars} />;
}
