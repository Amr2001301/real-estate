import { MessageSquareText } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { SectionPlaceholder } from '@/components/account/SectionPlaceholder';

export const metadata = buildMetadata({
  title: 'الطلبات',
  description: 'استفساراتك وطلباتك في دار الفخامة.',
  robots: { index: false, follow: false },
});

export default function AccountRequestsPage() {
  return <SectionPlaceholder title="الطلبات" icon={<MessageSquareText className="h-6 w-6" aria-hidden />} />;
}
