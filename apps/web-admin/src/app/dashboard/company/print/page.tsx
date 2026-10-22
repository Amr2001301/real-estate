import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { FileSignature, Plus, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { DEFAULT_PRINT_SETTINGS, type DocumentTemplate, type PrintSettings } from '@/lib/print-settings';
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

export default async function PrintSettingsPage() {
  const [settings, templates, locale] = await Promise.all([
    load<PrintSettings>('/company/print-settings', DEFAULT_PRINT_SETTINGS),
    load<DocumentTemplate[]>('/document-templates', []),
    getLocale(),
  ]);
  const m = printSettingsT(locale);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[{ label: m.breadcrumbAdmin }, { label: m.title }]}
      />

      <PrintSettingsForm initial={settings} m={m} />

      {/* ── Wording ── */}
      <section
        data-testid="document-templates"
        className="rounded-[22px] border border-hairline bg-surface p-6 shadow-[0_18px_40px_-30px_rgb(20_26_38/0.35)]"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-[17px] font-bold text-slate-900">{m.templates.title}</h2>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-slate-500">{m.templates.hint}</p>
          </div>
          <Link
            href="/dashboard/company/print/templates/new"
            data-testid="template-new"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-full bg-navy-band px-5 text-[12.5px] font-semibold text-[#F4ECD8]"
          >
            <Plus className="h-4 w-4" />
            {m.templates.add}
          </Link>
        </div>

        {templates.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-dashed border-hairline px-6 py-8 text-center text-[13px] text-slate-500">
            {m.templates.empty}
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {templates.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/dashboard/company/print/templates/${t.id}`}
                  data-testid="template-row"
                  className="group flex items-start gap-3 rounded-2xl border border-hairline p-4 transition-colors hover:border-[#C9A24E]/50"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#C9A24E]/50 text-[#B08A3A]">
                    <FileSignature className="h-[18px] w-[18px] stroke-[1.6]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-bold text-slate-900 group-hover:text-brand-700">{t.name}</span>
                      {t.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-400/30">
                          <Star className="h-3 w-3" />
                          {m.templates.default}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[12px] text-slate-500">
                      {m.templates.doc[t.documentType]}
                      {t.documentType === 'CONTRACT' && ` · ${m.templates.variant[t.variant]}`}
                      {' · '}
                      {m.templates.updated} {formatDate(t.updatedAt, locale)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
