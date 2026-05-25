import { CalendarClock } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { SectionPlaceholder } from '@/components/account/SectionPlaceholder';

export const metadata = buildMetadata({
  title: 'الزيارات',
  description: 'طلبات الزيارة الخاصة بك في دار الفخامة.',
  robots: { index: false, follow: false },
});

export default function AccountVisitsPage() {
  return <SectionPlaceholder title="الزيارات" icon={<CalendarClock className="h-6 w-6" aria-hidden />} />;
}
