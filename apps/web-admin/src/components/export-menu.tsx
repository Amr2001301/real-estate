'use client';

import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * P15.2 — shared export control. Styled XLSX is the default (single click on the
 * main button); the caret reveals a menu with the raw-data CSV fallback (and,
 * later, a board-style report). All downloads are binary-safe (fetch → blob →
 * anchor) and route through the authenticated proxies:
 *   • XLSX/PDF → /api/export  (preserves raw bytes + content-type)
 *   • CSV      → /api/csv     (text fallback)
 *
 * Shows a loading state and a friendly Arabic error — never a raw backend error,
 * never a silent no-op.
 */
interface ExportMenuProps {
  /** API path (no /v1) for the styled XLSX — must be whitelisted on /api/export. */
  xlsxPath: string;
  /** Base name for the downloaded file (date + extension appended). */
  filenameBase: string;
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

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-1">
      <div className="relative inline-flex items-stretch gap-1" ref={ref}>
        <Button
          type="button"
          variant="outline"
          size="md"
          loading={loading}
          leftIcon={<FileSpreadsheet className="h-4 w-4" />}
          onClick={() => download('export', xlsxPath, 'xlsx')}
        >
          {label}
        </Button>

        {csvPath && (
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
                <MenuItem
                  icon={<FileSpreadsheet className="h-4 w-4" />}
                  label="ملف Excel ‏(.xlsx)"
                  hint="منسّق"
                  onClick={() => download('export', xlsxPath, 'xlsx')}
                />
                <MenuItem
                  icon={<FileText className="h-4 w-4" />}
                  label="ملف CSV"
                  hint="بيانات خام"
                  onClick={() => download('csv', csvPath, 'csv')}
                />
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
