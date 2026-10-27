import { CalendarDays, Camera, Ghost, Mail, Megaphone, MessageCircle, MessageSquare, Music2, Signpost } from 'lucide-react';
import type { CampaignChannel, CampaignStatus } from '@/lib/types';
import { cn } from '@/lib/cn';

/* Visual pieces shared by the campaign pages: channel marks in each
   platform's colours, a budget gauge and a leads funnel. Server-safe. */

const MARK: Record<CampaignChannel, { bg: string; fg: string; glyph: React.ReactNode }> = {
  FACEBOOK: { bg: 'bg-[#1877F2]', fg: 'text-white', glyph: <span className="font-sans text-[1.15em] font-black leading-none">f</span> },
  INSTAGRAM: { bg: 'bg-[radial-gradient(circle_at_30%_110%,#fdf497_0%,#fd5949_45%,#d6249f_60%,#285AEB_90%)]', fg: 'text-white', glyph: <Camera /> },
  TIKTOK: { bg: 'bg-[#0b0b0f] ring-1 ring-inset ring-[#25F4EE]/40', fg: 'text-[#25F4EE]', glyph: <Music2 /> },
  GOOGLE: { bg: 'bg-white ring-1 ring-inset ring-slate-200', fg: 'text-[#4285F4]', glyph: <span className="font-sans text-[1.05em] font-black leading-none">G</span> },
  SNAPCHAT: { bg: 'bg-[#FFFC00]', fg: 'text-[#111]', glyph: <Ghost /> },
  WHATSAPP: { bg: 'bg-[#25D366]', fg: 'text-white', glyph: <MessageCircle /> },
  SMS: { bg: 'bg-sky-500', fg: 'text-white', glyph: <MessageSquare /> },
  EMAIL: { bg: 'bg-indigo-500', fg: 'text-white', glyph: <Mail /> },
  BILLBOARD: { bg: 'bg-orange-500', fg: 'text-white', glyph: <Signpost /> },
  EVENT: { bg: 'bg-violet-500', fg: 'text-white', glyph: <CalendarDays /> },
  OTHER: { bg: 'bg-gradient-to-br from-brand-400 to-brand-700', fg: 'text-[#1a1408]', glyph: <Megaphone /> },
};

/** A channel's mark: a rounded tile in the platform's colours. */
export function ChannelMark({ channel, size = 44, className }: { channel: CampaignChannel; size?: number; className?: string }) {
  const m = MARK[channel];
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[30%] shadow-[0_6px_16px_-6px_rgba(15,23,42,0.35)] [&_svg]:h-[1em] [&_svg]:w-[1em] [&_svg]:stroke-[2.2]',
        m.bg,
        m.fg,
        className,
      )}
    >
      {m.glyph}
    </span>
  );
}

const DOT: Record<CampaignStatus, string> = {
  PLANNED: 'bg-sky-500',
  ACTIVE: 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]',
  PAUSED: 'bg-amber-500',
  ENDED: 'bg-slate-400',
};

/** Status as a quiet pill with a coloured dot (the live one glows). */
export function StatusPill({ status, label, dark }: { status: CampaignStatus; label: string; dark?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold',
        dark ? 'bg-white/10 text-white/85 ring-1 ring-inset ring-white/15' : 'bg-surface-muted text-slate-600 ring-1 ring-inset ring-hairline',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT[status])} />
      {label}
    </span>
  );
}

/**
 * Spend against budget as a ring. Without a budget the ring stays empty and
 * the centre shows the spend only.
 */
export function BudgetRing({
  spent,
  budget,
  size = 112,
  center,
  caption,
  dark,
}: {
  spent: number;
  budget: number | null;
  size?: number;
  center: React.ReactNode;
  caption?: React.ReactNode;
  dark?: boolean;
}) {
  const pct = budget && budget > 0 ? Math.min(1, spent / budget) : 0;
  const over = budget != null && budget > 0 && spent > budget;
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="7" className={dark ? 'stroke-white/12' : 'stroke-surface-muted'} />
          {pct > 0 && <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${pct * c} ${c}`}
            className={over ? 'stroke-danger-500' : 'stroke-[#D8B66A]'}
          />}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
      </div>
      {caption && <div className={cn('text-[11.5px]', dark ? 'text-white/60' : 'text-slate-500')}>{caption}</div>}
    </div>
  );
}

/** Leads → interested → sales as tapering bars, each with its share of the leads. */
export function LeadFunnel({
  steps,
  dense,
}: {
  steps: Array<{ label: string; value: number; tone: string }>;
  dense?: boolean;
}) {
  const top = Math.max(1, steps[0]?.value ?? 0);
  return (
    <ol className={cn('flex flex-col', dense ? 'gap-1.5' : 'gap-2.5')}>
      {steps.map((s, i) => {
        const pct = Math.round((s.value / top) * 100);
        return (
          <li key={s.label} className="grid grid-cols-[minmax(84px,auto)_1fr_auto] items-center gap-3">
            <span className={cn('truncate text-slate-500', dense ? 'text-[11.5px]' : 'text-[12.5px]')}>{s.label}</span>
            <span className={cn('relative overflow-hidden rounded-full bg-surface-muted', dense ? 'h-2' : 'h-3')}>
              <span className={cn('absolute inset-y-0 start-0 rounded-full', s.tone)} style={{ width: `${s.value > 0 ? Math.max(pct, 3) : 0}%` }} />
            </span>
            <span className="inline-flex min-w-[64px] items-baseline justify-end gap-1.5">
              <span className={cn('num tabular-nums text-slate-900', dense ? 'text-[14px]' : 'text-[17px] font-semibold')}>{s.value}</span>
              {i > 0 && steps[0]!.value > 0 && (
                <span className="rounded-md bg-surface-muted px-1.5 py-px font-sans text-[10px] font-semibold tabular-nums text-slate-500">{pct}%</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
