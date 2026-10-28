import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requireAdmin } from '@/lib/session';
import { getDisabledFeatures } from '@/lib/capabilities';
import { getMyCodes } from '@/lib/permissions';
import { NAV_ICONS, filterSettingsHub } from '@/lib/nav';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';

export const dynamic = 'force-dynamic';

// «الإعدادات»: the company's set-up pages on one page, grouped, instead of a
// long run of sidebar links. Shows only the pages this user may open.
export default async function SettingsHubPage() {
  const user = await requireAdmin();
  const [locale, disabled, codes] = await Promise.all([getLocale(), getDisabledFeatures(user.role), getMyCodes()]);
  const groups = filterSettingsHub(user.role, disabled, codes);
  if (groups.length === 0) redirect('/dashboard');
  const t = uiT(locale);
  const m = t.nav;

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={m.hub.title}
        description={m.hub.description}
        breadcrumbs={[{ label: t.common.breadcrumbHome, href: '/dashboard' }, { label: m.hub.title }]}
      />
      {groups.map((g) => (
        <section key={g.group} data-testid="settings-group">
          <h2 className="mb-3 text-[13px] font-bold text-slate-500">{m.hub.groups[g.group]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map((item) => {
              const Icon = NAV_ICONS[item.iconKey];
              return (
                <Link
                  key={item.href}
                  href={item.href as never}
                  className="group flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 transition-colors hover:border-brand-400/50"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="flex-1 text-[14px] font-semibold text-slate-900">{m.items[item.labelKey]}</span>
                  <ChevronLeft aria-hidden className="h-4 w-4 text-slate-400 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180" />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
