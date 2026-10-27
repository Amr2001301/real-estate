import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { ChevronLeft, FileImage, FileSignature, FileText, Plus, Stamp, Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { DEFAULT_PRINT_SETTINGS, type DocumentTemplate, type PrintSettings } from '@/lib/print-settings';
import type { FormLayout } from '@/lib/form-layout';
import { PremiumPageHero } from '@/components/premium';
import { printSettingsT } from './messages';
import { PrintSettingsForm } from './_components/print-settings-form';

export const dynamic = 'force-dynamic';

async function load<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api.get<T>(path);
  } catch (e) {
    unstable_rethrow(e);
    return fallback;
  }
}

type Tab = 'paper' | 'seal' | 'forms' | 'wording';
const TABS: Tab[] = ['paper', 'seal', 'forms', 'wording'];
const TAB_ICON = { paper: FileText, seal: Stamp, forms: FileImage, wording: FileSignature };

export default async function PrintSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'paper';
  const [settings, templates, forms, locale] = await Promise.all([
    load<PrintSettings>('/company/print-settings', DEFAULT_PRINT_SETTINGS),
    load<DocumentTemplate[]>('/document-templates', []),
    load<FormLayout[]>('/form-layouts', []),
    getLocale(),
  ]);
  const m = printSettingsT(locale);
  const count = (n: number, [one, many]: readonly string[]) => (n === 0 ? m.status.none : n === 1 ? one! : `${n} ${many!}`);
  const status: Record<Tab, string> = {
    paper: m.paper.modes[settings.letterheadMode].label,
    seal: settings.signature && settings.stamp ? m.status.sealBoth : settings.signature || settings.stamp ? m.status.sealOne : m.status.sealNone,
    forms: count(forms.length, m.status.form),
    wording: count(templates.length, m.status.template),
  };

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[{ label: m.breadcrumbAdmin }, { label: m.title }]}
      />

      {/* ── The four parts, as tabs that also say where each stands ── */}
      <nav className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="print-tabs" aria-label={m.title}>
        {TABS.map((t) => {
          const Icon = TAB_ICON[t];
          const active = t === tab;
          return (
            <Link
              key={t}
              href={`/dashboard/company/print?tab=${t}`}
              scroll={false}
              aria-current={active ? 'page' : undefined}
              data-testid={`print-tab-${t}`}
              className={cn(
                'group flex items-center gap-3 rounded-[20px] border bg-surface p-4 transition-all',
                active
                  ? 'border-brand-500 shadow-[0_0_0_3px_rgb(200_162_75/0.15),0_18px_40px_-28px_rgb(20_26_38/0.45)]'
                  : 'border-hairline hover:border-brand-400/50',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors',
                  active ? 'bg-navy-band text-[#D8B66A]' : 'bg-brand-50 text-brand-700',
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-bold text-slate-900">{m.tabs[t].title}</span>
                <span className="block truncate text-[12px] text-slate-500">{status[t]}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      {(tab === 'paper' || tab === 'seal') && <PrintSettingsForm initial={settings} m={m} section={tab} />}

      {tab === 'forms' && (
        <section data-testid="form-layouts" className={CARD}>
          <SectionHead title={m.forms.title} hint={m.forms.hint} steps={m.how.forms} href="/dashboard/company/print/forms/new" add={m.forms.add} testId="form-new" />
          {forms.length === 0 ? (
            <Empty Icon={FileImage} text={m.forms.empty} cta={m.emptyCta.forms} href="/dashboard/company/print/forms/new" />
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {forms.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/dashboard/company/print/forms/${f.id}`}
                    data-testid="form-row"
                    className="group block overflow-hidden rounded-2xl border border-hairline bg-surface transition-all hover:-translate-y-0.5 hover:border-brand-400/60 hover:shadow-[0_18px_40px_-26px_rgb(20_26_38/0.45)]"
                  >
                    <span className="relative flex h-44 items-center justify-center overflow-hidden bg-canvas">
                      {f.pages[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.pages[0].imageUrl} alt="" className="h-40 w-auto rounded shadow-[0_8px_24px_-10px_rgb(20_26_38/0.45)] ring-1 ring-hairline transition-transform group-hover:scale-[1.03]" />
                      ) : (
                        <FileImage className="h-8 w-8 text-slate-300" />
                      )}
                      {f.isDefault && <DefaultBadge label={m.templates.default} />}
                    </span>
                    <span className="block border-t border-hairline px-4 py-3">
                      <span className="block truncate text-[14px] font-bold text-slate-900 group-hover:text-brand-700">{f.name}</span>
                      <span className="mt-0.5 block text-[12px] text-slate-500">
                        {m.forms.doc[f.documentType]} · {m.forms.paper[f.paperSize]} · {f.pages.length} {m.forms.page[f.pages.length === 1 ? 0 : 1]} · {f.fields.length} {m.forms.field[f.fields.length === 1 ? 0 : 1]}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'wording' && (
        <section data-testid="document-templates" className={CARD}>
          <SectionHead title={m.templates.title} hint={m.templates.hint} steps={m.how.wording} href="/dashboard/company/print/templates/new" add={m.templates.add} testId="template-new" />
          {templates.length === 0 ? (
            <Empty Icon={FileSignature} text={m.templates.empty} cta={m.emptyCta.wording} href="/dashboard/company/print/templates/new" />
          ) : (
            <ul className="mt-6 grid gap-3 md:grid-cols-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/dashboard/company/print/templates/${t.id}`}
                    data-testid="template-row"
                    className="group flex items-center gap-4 rounded-2xl border border-hairline bg-surface p-4 transition-all hover:border-brand-400/60 hover:shadow-[0_18px_40px_-26px_rgb(20_26_38/0.45)]"
                  >
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy-band text-[#D8B66A]">
                      <FileSignature className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14.5px] font-bold text-slate-900 group-hover:text-brand-700">{t.name}</span>
                        {t.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-400/30">
                            <Star className="h-3 w-3" />
                            {m.templates.default}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5 text-[11.5px]">
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold text-slate-600">{m.templates.doc[t.documentType]}</span>
                        {t.documentType === 'CONTRACT' && (
                          <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold text-slate-600">{m.templates.variant[t.variant]}</span>
                        )}
                        <span className="px-1 py-0.5 text-slate-400">
                          {m.templates.updated} {formatDate(t.updatedAt, locale)}
                        </span>
                      </span>
                    </span>
                    <ChevronLeft className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-0.5 group-hover:text-brand-700 ltr:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

const CARD = 'rounded-[22px] border border-hairline bg-surface p-6 shadow-[0_18px_40px_-30px_rgb(20_26_38/0.35)]';

function SectionHead({ title, hint, steps, href, add, testId }: { title: string; hint: string; steps: string[]; href: string; add: string; testId: string }) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-[18px] font-bold text-slate-900">{title}</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-500">{hint}</p>
        </div>
        <Link
          href={href}
          data-testid={testId}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-full bg-navy-band px-5 text-[12.5px] font-semibold text-[#F4ECD8]"
        >
          <Plus className="h-4 w-4" />
          {add}
        </Link>
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3.5 py-2.5 text-[12.5px] text-slate-600">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-[#1A1406]">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </>
  );
}

function Empty({ Icon, text, cta, href }: { Icon: typeof FileImage; text: string; cta: string; href: string }) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-brand-400/40 bg-brand-50/30 px-6 py-10 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-band text-[#D8B66A]">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-3 max-w-md text-[13px] text-slate-600">{text}</p>
      <Link href={href} className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full border border-brand-400/60 px-5 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-50">
        <Plus className="h-4 w-4" />
        {cta}
      </Link>
    </div>
  );
}

function DefaultBadge({ label }: { label: string }) {
  return (
    <span className="absolute end-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2 py-0.5 text-[11px] font-semibold text-brand-700 shadow-sm ring-1 ring-inset ring-brand-400/30">
      <Star className="h-3 w-3" />
      {label}
    </span>
  );
}
