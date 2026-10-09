export const dynamic = 'force-dynamic';

import { HardDriveDownload, Database, ShieldCheck, Clock } from 'lucide-react';
import { PremiumPageHero, PremiumSectionCard } from '@/components/premium';
import { ExportMenu } from '@/components/export-menu';
import { getLocale } from '@/lib/locale';
import { dataExportT } from '@/messages/data-export';

export default async function DataExportPage() {
  const locale = await getLocale();
  const m = dataExportT(locale);
  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[{ label: m.breadcrumbAdmin }, { label: m.title }]}
        actions={
          <ExportMenu
            locale={locale}
            xlsxPath="/data-export/export.xlsx"
            filenameBase="company-data"
            label={m.exportAll}
          />
        }
      />

      <PremiumSectionCard title={m.contentsTitle} description={m.contentsDescription}>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {m.sheets.map(([name, desc]) => (
            <div key={name} className="flex items-start gap-3 rounded-xl border border-hairline bg-surface p-3">
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">{name}</p>
                <p className="text-2xs text-slate-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </PremiumSectionCard>

      <PremiumSectionCard title={m.notesTitle} description={m.notesDescription}>
        <ul className="space-y-3 p-4 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
            <span>{m.noteScope}</span>
          </li>
          <li className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>{m.noteAudit}</span>
          </li>
          <li className="flex items-start gap-2">
            <HardDriveDownload className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              {m.noteRefBefore}{' '}
              <span dir="ltr" className="rounded bg-slate-100 px-1 font-mono text-2xs">_Ref</span>{' '}
              {m.noteRefAfter}
            </span>
          </li>
        </ul>
      </PremiumSectionCard>
    </div>
  );
}
