import { Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'error';

const TONES: Record<Tone, { wrap: string; icon: React.ReactNode }> = {
  info: { wrap: 'bg-navy/[0.04] text-navy border-navy/10', icon: <Info className="h-5 w-5" aria-hidden /> },
  success: { wrap: 'bg-success/10 text-success border-success/20', icon: <CheckCircle2 className="h-5 w-5" aria-hidden /> },
  warning: { wrap: 'bg-warning/10 text-warning border-warning/20', icon: <AlertTriangle className="h-5 w-5" aria-hidden /> },
  error: { wrap: 'bg-error/10 text-error border-error/20', icon: <XCircle className="h-5 w-5" aria-hidden /> },
};

interface InlineNoticeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

export function InlineNotice({ tone = 'info', children, className }: InlineNoticeProps) {
  const t = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm', t.wrap, className)}
    >
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
