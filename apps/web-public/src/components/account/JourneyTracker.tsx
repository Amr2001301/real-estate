import { CheckCircle2, Circle, Clock } from 'lucide-react';
import type { MeReservation, MeContract } from '@/lib/api-types';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';

type MilestoneStatus = 'done' | 'active' | 'upcoming';

interface Milestone {
  label: string;
  sub?: string;
  status: MilestoneStatus;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(new Date(iso));
  } catch {
    return '';
  }
}

function ms(label: string, sub: string | undefined, done: boolean, prev: boolean): Milestone {
  const status: MilestoneStatus = done ? 'done' : prev ? 'active' : 'upcoming';
  return { label, sub, status };
}

export async function JourneyTracker({
  reservations,
  contracts,
}: {
  reservations: MeReservation[];
  contracts: MeContract[];
}) {
  const locale = await getLocale();
  const t = siteT(locale).accountPages.journeyTracker;

  const activeReservation = reservations.find(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'CONVERTED',
  );
  const approvedReservation = reservations.find(
    (r) => r.status === 'APPROVED' || r.status === 'CONVERTED',
  );
  const activeContract = contracts[0] ?? null;
  const hasPlan = !!activeContract?.installmentPlan;
  const isSigned = !!activeContract?.signedAt;

  const visitDone = reservations.length > 0 || contracts.length > 0;
  const reservedDone = !!approvedReservation;
  const contractDone = !!activeContract;
  const signedDone = isSigned;
  const planDone = hasPlan;

  const milestones: Milestone[] = [
    ms(t.stepVisit, visitDone ? t.stepVisitDone : undefined, visitDone, true),
    ms(
      t.stepReservation,
      reservedDone ? t.stepReservationDone : activeReservation ? t.stepReservationPending : undefined,
      reservedDone,
      visitDone,
    ),
    ms(
      t.stepContract,
      signedDone ? formatDate(activeContract?.signedAt ?? null, locale) : undefined,
      signedDone,
      reservedDone,
    ),
    ms(
      t.stepDownPayment,
      contractDone && !planDone ? t.stepDownPaymentPending : planDone ? t.stepDownPaymentDone : undefined,
      planDone,
      contractDone,
    ),
    ms(
      t.stepPlan,
      hasPlan ? `${activeContract?.installmentPlan?.totalMonths ?? 0} ${t.stepPlanSuffix}` : undefined,
      hasPlan,
      contractDone,
    ),
    ms(t.stepKey, undefined, false, hasPlan),
  ];

  const doneCount = milestones.filter((m) => m.status === 'done').length;
  const pct = Math.round((doneCount / milestones.length) * 100);

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 sm:p-6 shadow-soft space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-base text-ink-strong">{t.title}</h2>
          <p className="text-xs text-ink-muted mt-0.5">{t.stagesComplete(doneCount, milestones.length)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-surface-soft overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-l from-gold-500 to-gold-300 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-bold text-gold-600">{pct}%</span>
        </div>
      </div>

      {/* Milestones */}
      <ol className="relative space-y-0">
        {milestones.map((m, i) => {
          const isLast = i === milestones.length - 1;
          return (
            <li key={m.label} className="flex gap-4">
              {/* Icon + vertical line */}
              <div className="flex flex-col items-center">
                <span
                  className={
                    m.status === 'done'
                      ? 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success'
                      : m.status === 'active'
                        ? 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-600 ring-2 ring-gold-300'
                        : 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-soft text-ink-muted/40'
                  }
                >
                  {m.status === 'done' ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  ) : m.status === 'active' ? (
                    <Clock className="h-4 w-4" aria-hidden />
                  ) : (
                    <Circle className="h-4 w-4" aria-hidden />
                  )}
                </span>
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 mt-1 mb-1 rounded-full ${
                      m.status === 'done' ? 'bg-success/30' : 'bg-hairline'
                    }`}
                    style={{ minHeight: 20 }}
                    aria-hidden
                  />
                )}
              </div>

              {/* Label */}
              <div className={`pb-4 ${isLast ? '' : ''} min-w-0`}>
                <p
                  className={`text-sm font-semibold leading-snug ${
                    m.status === 'done'
                      ? 'text-success'
                      : m.status === 'active'
                        ? 'text-gold-700'
                        : 'text-ink-muted/50'
                  }`}
                >
                  {m.label}
                </p>
                {m.sub && (
                  <p className="text-[11px] text-ink-muted mt-0.5">{m.sub}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
