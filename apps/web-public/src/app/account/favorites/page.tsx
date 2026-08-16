import { redirect } from 'next/navigation';
import { Heart } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { FavoriteItem } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { FavoriteCard } from '@/components/account/FavoriteCard';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';

export const metadata = buildMetadata({
  title: 'المفضلة',
  description: 'وحداتك ومشاريعك المحفوظة في ديفورا.',
  robots: { index: false, follow: false },
});

export default async function AccountFavoritesPage() {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.favorites;

  let favorites: FavoriteItem[];
  try {
    // GET /v1/me/favorites returns a plain array (not paginated).
    favorites = await authFetch<FavoriteItem[]>('/me/favorites');
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        <AccountPageHeader title={m.title} description={m.description} />
        <ErrorState
          title={m.errorTitle}
          message={m.errorMsg}
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AccountPageHeader title={m.title} description={m.description} />

      {favorites.length === 0 ? (
        <EmptyState
          title={m.emptyTitle}
          message={m.emptyMsg}
          icon={<Heart className="h-6 w-6" aria-hidden />}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href={routes.projects} variant="primary" size="md">
                {m.browseProjects}
              </ButtonLink>
              <ButtonLink href={routes.units} variant="outline" size="md">
                {m.exploreUnits}
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav) => (
            <FavoriteCard key={fav.id} favorite={fav} />
          ))}
        </div>
      )}
    </div>
  );
}
