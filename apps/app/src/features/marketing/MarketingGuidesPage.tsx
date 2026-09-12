import { GuidesHub } from '@/components/marketing/guides';

export interface MarketingGuidesPageProps {
  locale?: 'en' | 'ar';
  stars?: number;
}

export function MarketingGuidesPage({ locale = 'en', stars = 0 }: MarketingGuidesPageProps) {
  return <GuidesHub locale={locale} stars={stars} />;
}
