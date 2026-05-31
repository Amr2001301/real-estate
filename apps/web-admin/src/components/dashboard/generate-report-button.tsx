'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * P14.1 — "توليد تقرير" on the admin dashboard. Downloads the admin-summary CSV
 * (real `/reports/admin-summary` data) via the whitelisted `/api/csv` proxy,
 * which forwards the admin's Bearer token server-side. Shows a loading state
 * while generating and a friendly Arabic message on failure — never a silent
 * no-op and never a raw backend error.
 */
export function GenerateReportButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  async function handleClick() {
    if (state === 'loading') return;
    setState('loading');
    const filename = `admin-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    try {
      const res = await fetch(
        `/api/csv?path=${encodeURIComponent('/reports/admin-summary/export.csv')}&filename=${encodeURIComponent(filename)}`,
        { method: 'GET', credentials: 'include' },
      );
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
