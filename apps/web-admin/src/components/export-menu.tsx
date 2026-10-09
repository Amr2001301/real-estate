'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/locale';
import { portalSharedT } from '@/messages/portal/shared';

/**
 * The one export control used across the dashboard and the broker portal.
 *
 * One button, always the same look ("Export" + download icon):
 *   • a single format → the button downloads it directly ("Export Excel");
 *   • several formats → it opens a menu that says what each file is for
 *     (Excel: formatted report · PDF: company-branded, to print or share ·
 *     CSV: raw data for other systems);
 *   • several reports (`groups`) → one menu with a section per report, so a
 *     page never shows a row of export buttons.
 * Downloads are binary-safe (fetch → blob → anchor) through the whitelisting
 * proxies: XLSX/PDF → /api/export, CSV → /api/csv.
 */

export type ExportFormat = 'xlsx' | 'pdf' | 'csv';

export interface ExportGroup {
  /** Section title in the menu (e.g. "Sales"). */
  label?: string;
  /** Base name for the downloaded file (date + extension appended). */
  filenameBase: string;
  xlsxPath?: string;
  pdfPath?: string;
  csvPath?: string;
  /** Filters forwarded to the endpoint (empty values dropped). */
  params?: Record<string, string | undefined>;
}

interface ExportMenuProps extends Partial<ExportGroup> {
  /** Several reports in one menu; overrides the single-report props. */
  groups?: ExportGroup[];
  /** Button label (defaults to "Export"). */
  label?: string;
  locale: Locale;
}

const ICON: Record<ExportFormat, typeof FileText> = {
  xlsx: FileSpreadsheet,
  pdf: FileText,
  csv: Sheet,
};

const TINT: Record<ExportFormat, string> = {
  xlsx: 'bg-emerald-50 text-emerald-700',
  pdf: 'bg-rose-50 text-rose-700',
  csv: 'bg-slate-100 text-slate-600',
};

interface Option {
  key: string;
  format: ExportFormat;
  path: string;
  group: ExportGroup;
}

function optionsOf(group: ExportGroup): Option[] {
  const out: Option[] = [];
  const add = (format: ExportFormat, path?: string) =>
    path && out.push({ key: `${group.filenameBase}:${format}`, format, path, group });
  add('xlsx', group.xlsxPath);
  add('pdf', group.pdfPath);
  add('csv', group.csvPath);
  return out;
}

export function ExportMenu({ groups, label, locale, ...single }: ExportMenuProps) {
  const t = portalSharedT(locale).exportMenu;
  const sections: ExportGroup[] =
    groups ?? (single.filenameBase ? [single as ExportGroup] : []);
  const options = sections.flatMap(optionsOf);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function download(o: Option) {
    if (busy) return;
    setOpen(false);
    setError(false);
    setBusy(o.key);
    const filename = `${o.group.filenameBase}-${new Date().toISOString().slice(0, 10)}.${o.format}`;
    const qs = new URLSearchParams({ path: o.path, filename });
    for (const [k, v] of Object.entries(o.group.params ?? {})) if (v) qs.set(k, v);
    try {
      const res = await fetch(`/api/${o.format === 'csv' ? 'csv' : 'export'}?${qs}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  if (options.length === 0) return null;

  const only = options.length === 1 ? options[0] : null;
  const text = label ?? (only ? t.single[only.format] : t.label);

  return (
    <div className="relative flex flex-col items-stretch gap-1 sm:items-end" ref={ref}>
      <Button
        type="button"
        variant="outline"
        size="md"
        loading={busy !== null}
        leftIcon={<Download className="h-4 w-4" />}
        rightIcon={only ? undefined : <ChevronDown className="h-4 w-4 opacity-60" />}
        aria-haspopup={only ? undefined : 'menu'}
        aria-expanded={only ? undefined : open}
        data-testid="export-menu"
        onClick={() => (only ? download(only) : setOpen((v) => !v))}
      >
        {busy ? t.preparing : text}
      </Button>

      {open && (
        <div
          role="menu"
          aria-label={t.optionsAria}
          className="absolute end-0 top-full z-50 mt-2 w-72 rounded-2xl border border-hairline bg-surface p-1.5 shadow-lg animate-fade-in"
        >
          {sections.map((g, gi) => {
            const opts = optionsOf(g);
            if (opts.length === 0) return null;
            return (
              <div key={g.filenameBase} className={gi > 0 ? 'mt-1 border-t border-hairline pt-1' : ''}>
                {g.label && (
                  <div className="px-2.5 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-slate-400">
                    {g.label}
                  </div>
                )}
                {opts.map((o) => {
                  const Icon = ICON[o.format];
                  return (
                    <button
                      key={o.key}
                      type="button"
                      role="menuitem"
                      data-testid={`export-${o.key}`}
                      onClick={() => download(o)}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-surface-muted"
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TINT[o.format]}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-800">{t.formats[o.format]}</span>
                        <span className="block text-2xs text-slate-500">{t.hints[o.format]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <span role="alert" className="text-2xs text-danger-600">
          {t.error}
        </span>
      )}
    </div>
  );
}
