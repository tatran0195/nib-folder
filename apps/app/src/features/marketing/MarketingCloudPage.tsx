import { CloudPage } from '@/components/cloud-marketing';

export interface MarketingCloudPageProps {
  stars?: number;
}

export function MarketingCloudPage({ stars = 0 }: MarketingCloudPageProps) {
  return <CloudPage stars={stars} />;
}
