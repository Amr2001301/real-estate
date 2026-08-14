import { Phone, Mail, MessageCircle, User2 } from 'lucide-react';
import type { MeReservation, MeVisitRequest } from '@/lib/api-types';

interface Specialist {
  fullName: string;
  phone?: string | null;
  email?: string | null;
}

function getSpecialist(
  reservations: MeReservation[],
  visits: MeVisitRequest[],
): Specialist | null {
  // Prefer the sales rep from the most recent active reservation.
  for (const r of reservations) {
    if (r.sales) return r.sales;
  }
  // Fall back to assigned sales from visits.
  for (const v of visits) {
    if (v.assignedSales) return v.assignedSales;
  }
  return null;
}

export function ContactSpecialist({
  reservations,
  visits,
}: {
  reservations: MeReservation[];
  visits: MeVisitRequest[];
}) {
  const specialist = getSpecialist(reservations, visits);
  if (!specialist) return null;

  const waLink = specialist.phone
    ? `https://wa.me/${specialist.phone.replace(/[^\d]/g, '')}`
    : null;

  return (
    <div className="rounded-2xl border border-hairline bg-surface shadow-soft overflow-hidden">
      {/* Gold accent bar */}
      <div
        className="h-0.5 w-full"
        style={{ background: 'linear-gradient(to left, transparent, rgba(200,162,75,0.5), transparent)' }}
        aria-hidden
      />

      <div className="p-5 sm:p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/60">
            <User2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">مختصك العقاري</p>
            <p className="mt-0.5 font-bold text-ink-strong">{specialist.fullName}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              {/* WhatsApp icon */}
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.557 4.126 1.532 5.862L.057 23.547a.75.75 0 00.921.908l5.85-1.533A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.921 0-3.73-.5-5.3-1.376l-.38-.217-3.473.91.926-3.38-.237-.39A9.954 9.954 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
              واتساب
            </a>
          )}
          {specialist.phone && (
            <a
              href={`tel:${specialist.phone}`}
              className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface-soft px-4 py-2.5 text-sm font-medium text-ink-strong transition-colors hover:border-gold-200 hover:bg-gold-50/50"
            >
              <Phone className="h-4 w-4 shrink-0 text-gold-500" aria-hidden />
              اتصال
            </a>
          )}
          {specialist.email && (
            <a
              href={`mailto:${specialist.email}`}
              className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface-soft px-4 py-2.5 text-sm font-medium text-ink-strong transition-colors hover:border-gold-200 hover:bg-gold-50/50"
            >
              <Mail className="h-4 w-4 shrink-0 text-gold-500" aria-hidden />
              بريد
            </a>
          )}
        </div>

        <p className="text-[11px] text-ink-muted leading-relaxed">
          فريقنا متاح للإجابة على استفساراتك ومساعدتك في كل مرحلة من رحلتك العقارية.
        </p>
      </div>
    </div>
  );
}
