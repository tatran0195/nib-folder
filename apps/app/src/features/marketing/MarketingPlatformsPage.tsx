import { DocumentationPlatformsPage } from '@/components/marketing/documentation-platforms';

export interface MarketingPlatformsPageProps {
  stars?: number;
}

export function MarketingPlatformsPage({ stars = 0 }: MarketingPlatformsPageProps) {
  return <DocumentationPlatformsPage stars={stars} />;
}
