import { BellRing } from 'lucide-react';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { saveNotificationPreferencesAction } from '@/lib/account-actions';

export type PrefGroup = 'sales' | 'finance' | 'maintenance' | 'account';
export type NotificationPrefs = Record<'email' | 'push', Record<PrefGroup, boolean>>;

const GROUPS: PrefGroup[] = ['sales', 'finance', 'maintenance', 'account'];

interface Labels {
  prefsTitle: string;
  prefsHint: string;
  prefsEmail: string;
  prefsPush: string;
  prefsSave: string;
  prefsGroups: Record<PrefGroup, string>;
}

/** E-mail / push switches per group; in-app notifications always arrive. */
export function NotificationPreferencesForm({ prefs, m }: { prefs: NotificationPrefs; m: Labels }) {
  return (
    <PremiumCard className="p-5">
      <form action={saveNotificationPreferencesAction}>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600 ring-1 ring-gold-200/70">
            <BellRing className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-strong">{m.prefsTitle}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{m.prefsHint}</p>
          </div>
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-ink-muted">
              <th className="py-2 text-start font-medium" />
              <th className="w-20 py-2 text-center font-medium">{m.prefsEmail}</th>
              <th className="w-20 py-2 text-center font-medium">{m.prefsPush}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline/60">
            {GROUPS.map((group) => (
              <tr key={group}>
                <td className="py-3 pe-3 text-ink">{m.prefsGroups[group]}</td>
                {(['email', 'push'] as const).map((channel) => (
                  <td key={channel} className="py-3 text-center">
                    <input
                      type="checkbox"
                      name={`${channel}.${group}`}
                      defaultChecked={prefs[channel][group]}
                      aria-label={`${m.prefsGroups[group]} — ${channel === 'email' ? m.prefsEmail : m.prefsPush}`}
                      className="h-4 w-4 cursor-pointer accent-gold-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink-strong transition-colors hover:border-gold-300 hover:text-gold-600"
          >
            {m.prefsSave}
          </button>
        </div>
      </form>
    </PremiumCard>
  );
}
