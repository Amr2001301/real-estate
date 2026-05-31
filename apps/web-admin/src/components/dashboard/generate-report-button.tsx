'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * P14.2 — "توليد تقرير" on the admin dashboard. Downloads the styled admin
 * dashboard XLSX report (real `/reports/admin-summary` data) via the
 * authenticated `/api-proxy` (which forwards the admin's Bearer token
 * server-side and preserves the binary content-type). Shows a loading state
 * while generating and a friendly Arabic message on failure — never a silent
 * no-op and never a raw backend error. (The CSV endpoint remains as a raw-data
 * fallback but is no longer surfaced in the UI.)
 */
export function GenerateReportButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  async function handleClick() {
    if (state === 'loading') return;
    setState('loading');
    const filename = `admin-summary-${new Date().toISOString().slice(0, 10)}.xlsx`;
    try {
      const res = await fetch('/api-proxy/reports/admin-summary/export.xlsx', {
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

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="md"
        loading={state === 'loading'}
        leftIcon={<FileText className="h-4 w-4" />}
        onClick={handleClick}
      >
        توليد تقرير
      </Button>
      {state === 'error' && (
        <span className="text-2xs text-danger-600">تعذّر توليد التقرير، حاول مرة أخرى.</span>
      )}
    </div>
  );
}
