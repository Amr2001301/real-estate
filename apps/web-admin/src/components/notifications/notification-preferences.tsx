'use client';

import { useState, useTransition } from 'react';
import { BellRing } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { updateNotificationPreferencesAction } from '@/app/_actions/notifications';
import type { Locale } from '@/lib/locale';

export type PrefGroup = 'sales' | 'finance' | 'maintenance' | 'account';
export type PrefChannel = 'email' | 'push';
export type NotificationPrefs = Record<PrefChannel, Record<PrefGroup, boolean>>;

const GROUPS: PrefGroup[] = ['sales', 'finance', 'maintenance', 'account'];

const T = {
  ar: {
    title: 'تفضيلات الإشعارات',
    hint: 'تصلك الإشعارات داخل المنصة دائماً. اختر ما يصلك منها أيضاً بالبريد أو على الموبايل.',
    email: 'البريد',
    push: 'الموبايل',
    saveError: 'تعذّر حفظ التغيير، حاول مرة أخرى.',
    groups: {
      sales: 'المبيعات — العملاء والزيارات والحجوزات والعقود',
      finance: 'المالية — الأقساط والدفعات والشيكات والمكافآت',
      maintenance: 'الصيانة',
      account: 'الحساب والاشتراك والفريق',
    },
  },
  en: {
    title: 'Notification preferences',
    hint: 'In-app notifications always arrive. Choose which ones also reach you by e-mail or on your phone.',
    email: 'E-mail',
    push: 'Phone',
    saveError: 'Could not save the change. Please try again.',
    groups: {
      sales: 'Sales — leads, visits, reservations and contracts',
      finance: 'Finance — installments, payments, cheques and bonuses',
      maintenance: 'Maintenance',
      account: 'Account, subscription and team',
    },
  },
} as const;

/** Per-group e-mail / push switches; each change is saved at once. */
export function NotificationPreferences({
  initial,
  locale = 'ar',
  bare = false,
}: {
  initial: NotificationPrefs;
  locale?: Locale;
  /** A list for a page panel, without its own card and heading. */
  bare?: boolean;
}) {
  const t = T[locale];
  const [prefs, setPrefs] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (channel: PrefChannel, group: PrefGroup, value: boolean) => {
    const previous = prefs;
    setPrefs({ ...prefs, [channel]: { ...prefs[channel], [group]: value } });
    setError(null);
    startTransition(async () => {
      const res = await updateNotificationPreferencesAction(channel, group, value);
      if (res.error) {
        setPrefs(previous);
        setError(t.saveError);
      }
    });
  };

  if (bare) {
    return (
      <div className="border-t border-hairline">
        <p className="px-6 py-3 text-[12.5px] leading-relaxed text-slate-500">{t.hint}</p>
        <ul className="divide-y divide-hairline border-t border-hairline">
          {GROUPS.map((group) => {
            const [name, detail] = t.groups[group].split(' — ');
            return (
              <li key={group} className="px-6 py-4">
                <p className="text-[14px] font-semibold text-slate-900">{name}</p>
                {detail && <p className="mt-0.5 text-[12px] text-slate-500">{detail}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(['email', 'push'] as const).map((channel) => (
                    <label
                      key={channel}
                      className="inline-flex items-center gap-2.5 rounded-full border border-hairline py-1 pe-1 ps-3 text-[12.5px] font-medium text-slate-600"
                    >
                      {t[channel]}
                      <Switch
                        checked={prefs[channel][group]}
                        disabled={pending}
                        label={`${t.groups[group]} — ${t[channel]}`}
                        onCheckedChange={(v) => toggle(channel, group, v)}
                      />
                    </label>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        {error && <p className="px-6 pb-4 text-sm text-danger-600">{error}</p>}
      </div>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-400/50 text-brand-700">
          <BellRing className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{t.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{t.hint}</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="py-2 text-start font-medium" />
              <th className="w-24 py-2 text-center font-medium">{t.email}</th>
              <th className="w-24 py-2 text-center font-medium">{t.push}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {GROUPS.map((group) => (
              <tr key={group}>
                <td className="py-3 pe-3 text-slate-700">{t.groups[group]}</td>
                {(['email', 'push'] as const).map((channel) => (
                  <td key={channel} className="py-3 text-center">
                    <Switch
                      checked={prefs[channel][group]}
                      disabled={pending}
                      label={`${t.groups[group]} — ${t[channel]}`}
                      onCheckedChange={(v) => toggle(channel, group, v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
    </Card>
  );
}
