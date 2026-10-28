import { Laptop, Smartphone, MonitorSmartphone, HelpCircle } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { formatDateTime } from '@/lib/format';
import { describeDevice } from '@/lib/device';
import { cn } from '@/lib/cn';
import { securityT } from './security-messages';

export interface SessionRow {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  current?: boolean;
}

const ICON = { desktop: Laptop, mobile: Smartphone, app: MonitorSmartphone, unknown: HelpCircle } as const;

/** SES1 — a list of signed-in devices; each may carry a sign-out button. */
export function SessionsList({
  sessions,
  locale,
  timeZone,
  revoke,
}: {
  sessions: SessionRow[];
  locale: Locale;
  timeZone: string;
  revoke?: (id: string) => Promise<void>;
}) {
  const m = securityT(locale);
  return (
    <ul className="divide-y divide-hairline" data-testid="sessions-list">
      {sessions.map((s) => {
        const d = describeDevice(s.userAgent);
        const Icon = ICON[d.kind];
        const name =
          d.kind === 'app' ? m.app : d.browser || d.os ? [d.browser, d.os].filter(Boolean).join(` ${m.on} `) : m.unknown;
        return (
          <li key={s.id} className="flex items-center gap-3 py-3" data-testid="session-row">
            <span
              className={cn(
                'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                s.current ? 'bg-emerald-500/12 text-emerald-700' : 'bg-surface-muted text-slate-600',
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold text-slate-900">
                <span dir="ltr">{name}</span>
                {s.current && (
                  <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{m.current}</span>
                )}
              </p>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {m.lastSeen}: {formatDateTime(s.lastSeenAt, locale, timeZone)} · {m.signedIn}: {formatDateTime(s.createdAt, locale, timeZone)}
                {s.ipAddress && (
                  <>
                    {' '}· {m.ip}: <span dir="ltr" className="tabular-nums">{s.ipAddress}</span>
                  </>
                )}
              </p>
            </div>
            {revoke && !s.current && (
              <form action={revoke.bind(null, s.id)}>
                <button
                  type="submit"
                  className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold text-danger-600 transition-colors hover:bg-danger-500/10"
                >
                  {m.end}
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
