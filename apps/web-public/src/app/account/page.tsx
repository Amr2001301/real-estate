import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserCircle2, Heart, CalendarClock, MessageSquareText, ArrowLeft } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/session';
import { ButtonLink } from '@/components/ui/Button';

export const metadata = buildMetadata({
  title: 'لوحة الحساب',
  description: 'منطقة العميل في دار الفخامة.',
  robots: { index: false, follow: false },
});

const TILES: Array<{ href: string; label: string; desc: string; icon: typeof Heart }> = [
  { href: routes.accountProfile, label: 'الملف الشخصي', desc: 'إدارة بياناتك ومعلومات التواصل', icon: UserCircle2 },
  { href: routes.accountFavorites, label: 'المفضلة', desc: 'الوحدات والمشاريع التي حفظتها', icon: Heart },
  { href: routes.accountVisits, label: 'الزيارات', desc: 'متابعة مواعيد زياراتك المجدولة', icon: CalendarClock },
  { href: routes.accountRequests, label: 'الطلبات', desc: 'استفساراتك وطلبات المعلومات', icon: MessageSquareText },
];

/**
 * Dashboard — greeting + section shortcuts. No counts/data are fetched yet
 * (neutral hints instead of fabricated numbers); the layout supplies the
 * sidebar profile + nav. Feature pages are wired in subsequent steps.
 */
export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="space-y-6">
      {/* Greeting + quick actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl text-ink-strong sm:text-3xl">
            مرحبًا{session.fullName ? `، ${session.fullName}` : ''}
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            تابع مفضلاتك وزياراتك وطلباتك، وحدّث بياناتك من مكان واحد.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={routes.projects} variant="primary" size="md">
            تصفّح المشاريع
          </ButtonLink>
          <ButtonLink href={routes.units} variant="outline" size="md">
            استكشف الوحدات
          </ButtonLink>
        </div>
      </div>

      {/* Section shortcuts — rich horizontal rows (icon + title + description + arrow) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {TILES.map(({ href, label, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href as Route}
            className="group flex items-center gap-4 rounded-2xl border border-hairline bg-surface p-5 shadow-soft transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-gold-300 hover:shadow-lift"
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70 transition-all duration-300 group-hover:from-gold-300 group-hover:to-gold-500 group-hover:text-navy group-hover:ring-gold-400">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-ink-strong">{label}</h3>
              <p className="mt-0.5 truncate text-sm text-ink-muted">{desc}</p>
            </div>
            <ArrowLeft
              className="h-5 w-5 shrink-0 text-ink-muted transition-all duration-300 group-hover:-translate-x-1 group-hover:text-gold-600"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
