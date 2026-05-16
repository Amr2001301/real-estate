'use client';
import { Download } from 'lucide-react';
import { cn } from '@/lib/cn';

export function ExportButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border border-hairline bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-800 transition-colors',
        className,
      )}
    >
      <Download className="h-4 w-4" />
      تصدير البيانات
    </button>
  );
}
