import { api, safe } from '@/lib/api';
import { projectOptions } from '@/lib/options';
import type { CampaignChannel, IntakeKey, LeadRoutingSettings } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import { intakeT } from '@/components/campaigns/intake-messages';
import { campaignT } from '@/components/campaigns/messages';
import { RoutingCard } from './_components/routing-card';
import { IntakeSources } from './_components/intake-sources';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** «استقبال العملاء تلقائيًا» — intake sources and how new leads are handed out. */
export default async function IntakePage() {
  const [locale, session] = await Promise.all([getLocale(), getSession()]);
  const m = intakeT(locale);
  const canManage = session?.role === 'ADMIN';
  const [settingsRes, keysRes, campaignsRes, projectsRes] = await Promise.all([
    safe(api.get<LeadRoutingSettings>('/lead-intake/settings')),
    canManage ? safe(api.get<IntakeKey[]>('/lead-intake/keys')) : Promise.resolve({ data: [] as IntakeKey[], error: null }),
    safe(api.get<Array<{ id: string; name: string; channel: CampaignChannel }>>('/campaigns/options')),
    safe(projectOptions()),
  ]);
  const settings = settingsRes.data ?? { autoAssign: 'ROUND_ROBIN' as const, firstCallMinutes: 60, companySlug: null };
  // The address lead sources post to: the API as the outside world reaches it.
  const apiBase = (process.env.PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const endpoint = `${apiBase}/v1/intake/${settings.companySlug ?? '<company>'}/leads`;

  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={m.eyebrow}
        title={m.title}
        description={m.desc}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: campaignT(locale).list.title, href: '/dashboard/campaigns' },
          { label: m.title },
        ]}
      />

      {/* How a lead arrives */}
      <ol className="relative grid grid-cols-1 gap-px overflow-hidden rounded-[24px] bg-[#D8B66A]/20 shadow-[0_24px_60px_-34px_rgba(14,22,38,0.9)] sm:grid-cols-2 xl:grid-cols-4">
        {m.flow.map((step, i) => (
          <li key={step.title} className="bg-navy-band p-5 text-white">
            <span className="num text-[30px] leading-none text-[#D8B66A]">0{i + 1}</span>
            <p className="mt-3 text-[14px] font-bold">{step.title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">{step.desc}</p>
          </li>
        ))}
      </ol>

      <RoutingCard initial={settings} canManage={canManage} m={m.routing} />

      {canManage && (
        <IntakeSources
          locale={locale}
          keys={keysRes.data ?? []}
          campaigns={campaignsRes.data ?? []}
          projects={projectsRes.data?.data ?? []}
          endpoint={endpoint}
          canManage={canManage}
          m={m}
        />
      )}

      <section className="rounded-[24px] border border-hairline bg-surface p-5 sm:p-6">
        <h2 className="font-heading text-[18px] font-bold text-slate-900">{m.guide.title}</h2>
        <p className="mt-1 text-[12.5px] text-slate-500">{m.guide.desc}</p>
        <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ol className="space-y-3">
            {m.guide.steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-[13px] leading-relaxed text-slate-700">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/15 text-[12px] font-bold text-brand-800">{i + 1}</span>
                {s}
              </li>
            ))}
            <li className="rounded-2xl bg-surface-muted/60 px-4 py-3 text-[12.5px] text-slate-600 ring-1 ring-inset ring-hairline">{m.guide.repeat}</li>
          </ol>
          <div>
            <p className="mb-2 text-[12px] font-semibold text-slate-500">{m.guide.fields}</p>
            <table className="w-full overflow-hidden rounded-2xl text-[12.5px] ring-1 ring-hairline">
              <tbody className="divide-y divide-hairline">
                {m.guide.rows.map(([field, what, required]) => (
                  <tr key={field} className="bg-surface">
                    <td className="px-3 py-2.5"><code dir="ltr" className="font-mono text-[12px] font-semibold text-slate-900">{field}</code></td>
                    <td className="px-3 py-2.5 text-slate-600">{what}</td>
                    <td className="px-3 py-2.5 text-end">
                      <span className={required ? 'rounded-full bg-[#D8B66A]/15 px-2 py-0.5 text-[11px] font-semibold text-brand-800' : 'text-[11px] text-slate-400'}>
                        {required ? m.guide.required : m.guide.optional}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <pre dir="ltr" className="mt-4 overflow-x-auto rounded-2xl bg-navy-band p-4 font-mono text-[11.5px] leading-relaxed text-[#E9D9B0]">{`POST ${endpoint}
X-Intake-Key: lk_…
Content-Type: application/json

{ "name": "Ahmed Ali", "phone": "01012345678",
  "campaign": "summer-offer", "message": "3 bedrooms" }`}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}
