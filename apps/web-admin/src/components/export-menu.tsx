'use client';

import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * P15.2 — shared export control. Styled XLSX is the default (single click on the
 * main button); the caret reveals a menu with PDF and raw-data CSV options.
 * All downloads are binary-safe (fetch → blob → anchor) routed through proxies:
 *   • XLSX/PDF → /api/export  (preserves raw bytes + content-type)
 *   • CSV      → /api/csv     (text fallback)
 */
interface ExportMenuProps {
  /** API path (no /v1) for the styled XLSX. When omitted, pdfPath becomes primary. */
  xlsxPath?: string;
  /** Base name for the downloaded file (date + extension appended). */
  filenameBase: string;
  /** Optional branded PDF path — must be whitelisted on /api/export. */
  pdfPath?: string;
  /** Optional raw-data CSV fallback path — must be whitelisted on /api/csv. */
  csvPath?: string;
  /** Extra query params (filters) forwarded to the upstream endpoint. */
  params?: Record<string, string | undefined>;
  /** Main button label. */
  label?: string;
}

export function ExportMenu({
  xlsxPath,
  filenameBase,
  pdfPath,
  csvPath,
  params,
  label = 'تصدير',
}: ExportMenuProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
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

  function buildQuery(path: string, filename: string): string {
    const qs = new URLSearchParams();
    qs.set('path', path);
    qs.set('filename', filename);
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v) qs.set(k, v);
    }
    return qs.toString();
  }

  async function download(route: 'export' | 'csv', path: string, ext: string) {
    if (state === 'loading') return;
    setOpen(false);
    setState('loading');
    const filename = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.${ext}`;
    try {
      const res = await fetch(`/api/${route}?${buildQuery(path, filename)}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) {
        setState('error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState('idle');
    } catch {
      setState('error');
    }
  }

  const loading = state === 'loading';
  // Primary action: XLSX if available, otherwise PDF.
  const primaryPath = xlsxPath ?? pdfPath ?? '';
  const primaryExt  = xlsxPath ? 'xlsx' : 'pdf';
  const primaryIcon = xlsxPath ? <FileSpreadsheet className="h-4 w-4" /> : <FileText className="h-4 w-4" />;
  // Show the caret dropdown when there are secondary options beyond the primary.
  const hasSecondary = (xlsxPath && pdfPath) || pdfPath || csvPath;

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-1">
      <div className="relative inline-flex items-stretch gap-1" ref={ref}>
        <Button
          type="button"
          variant="outline"
          size="md"
          loading={loading}
          leftIcon={primaryIcon}
          onClick={() => download('export', primaryPath, primaryExt)}
        >
          {label}
        </Button>

        {hasSecondary && (
          <>
            <Button
              type="button"
              variant="outline"
              size="md"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="خيارات التصدير"
              disabled={loading}
              onClick={() => setOpen((v) => !v)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>

            {open && (
              <div
                role="menu"
                className="absolute end-0 top-full mt-2 w-56 bg-surface border border-hairline rounded-2xl shadow-lg p-1.5 animate-fade-in z-50"
              >
                {xlsxPath && (
                  <MenuItem
                    icon={<FileSpreadsheet className="h-4 w-4" />}
                    label="ملف Excel ‏(.xlsx)"
                    hint="منسّق"
                    onClick={() => download('export', xlsxPath, 'xlsx')}
                  />
                )}
                {pdfPath && (
                  <MenuItem
                    icon={<FileText className="h-4 w-4" />}
                    label="ملف PDF"
                    hint="مُبرمَج"
                    onClick={() => download('export', pdfPath, 'pdf')}
                  />
                )}
                {csvPath && (
                  <MenuItem
                    icon={<FileText className="h-4 w-4" />}
                    label="ملف CSV"
                    hint="بيانات خام"
                    onClick={() => download('csv', csvPath, 'csv')}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {state === 'error' && (
        <span className="text-2xs text-danger-600">تعذّر توليد التقرير، حاول مرة أخرى.</span>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-sm text-slate-700 hover:bg-surface-muted transition-colors"
    >
      <span className="text-slate-400">{icon}</span>
      <span className="flex-1 text-start">{label}</span>
      {hint && <span className="text-2xs text-slate-400">{hint}</span>}
    </button>
  );
}
