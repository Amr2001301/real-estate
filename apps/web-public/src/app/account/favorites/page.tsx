import { redirect } from 'next/navigation';
import { Heart } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { FavoriteItem } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { FavoriteCard } from '@/components/account/FavoriteCard';

export const metadata = buildMetadata({
  title: 'المفضلة',
  description: 'وحداتك ومشاريعك المحفوظة في ديفورا.',
  robots: { index: false, follow: false },
});

export default async function AccountFavoritesPage() {
  let favorites: FavoriteItem[];
  try {
    // GET /v1/me/favorites returns a plain array (not paginated).
    favorites = await authFetch<FavoriteItem[]>('/me/favorites');
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-6">
        <h1 className="text-2xl text-ink-strong">المفضلة</h1>
        <ErrorState
          title="تعذّر تحميل المفضلة حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-ink-strong">المفضلة</h1>
        <p className="mt-1.5 text-sm text-ink-muted">المشاريع والوحدات التي حفظتها للرجوع إليها لاحقًا.</p>
      </div>

      {favorites.length === 0 ? (
        <EmptyState
          title="لا توجد عناصر محفوظة بعد"
          message="تصفّح المشاريع والوحدات واحفظ ما يهمّك للعودة إليه بسهولة."
          icon={<Heart className="h-6 w-6" aria-hidden />}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href={routes.projects} variant="primary" size="md">
                تصفّح المشاريع
              </ButtonLink>
              <ButtonLink href={routes.units} variant="outline" size="md">
                استكشف الوحدات
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {favorites.map((fav) => (
            <FavoriteCard key={fav.id} favorite={fav} />
          ))}
        </div>
      )}
    </div>
  );
}
