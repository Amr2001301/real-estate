import { Heart } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { SectionPlaceholder } from '@/components/account/SectionPlaceholder';

export const metadata = buildMetadata({
  title: 'المفضلة',
  description: 'وحداتك ومشاريعك المحفوظة في دار الفخامة.',
  robots: { index: false, follow: false },
});

export default function AccountFavoritesPage() {
  return <SectionPlaceholder title="المفضلة" icon={<Heart className="h-6 w-6" aria-hidden />} />;
}
