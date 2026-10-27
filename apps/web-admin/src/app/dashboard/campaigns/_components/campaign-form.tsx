'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { Campaign, CampaignChannel, CampaignStatus, Translatable } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { campaignT, CHANNEL_TONE } from '@/components/campaigns/messages';
import { createCampaignAction, updateCampaignAction, type CampaignFormState } from '../actions';

const CHANNELS: CampaignChannel[] = ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'GOOGLE', 'SNAPCHAT', 'WHATSAPP', 'SMS', 'EMAIL', 'BILLBOARD', 'EVENT', 'OTHER'];
const STATUSES: CampaignStatus[] = ['PLANNED', 'ACTIVE', 'PAUSED', 'ENDED'];
const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');

/** Create or edit a campaign. */
export function CampaignForm({
  locale,
  campaign,
  projects,
  sources,
}: {
  locale: Locale;
  campaign?: Campaign;
  projects: Array<{ id: string; name: Translatable }>;
  sources: Array<{ id: string; name: Translatable }>;
}) {
  const m = campaignT(locale);
  const f = m.form;
  const action = campaign ? updateCampaignAction.bind(null, campaign.id) : createCampaignAction;
  const [state, formAction, pending] = useActionState<CampaignFormState, FormData>(action, {});
  const [channel, setChannel] = useState<CampaignChannel>(campaign?.channel ?? 'FACEBOOK');
  const label = 'block text-[12.5px] font-semibold text-slate-600';

  return (
    <form action={formAction} data-testid="campaign-form" className="space-y-6 rounded-[22px] border border-hairline bg-surface p-5 sm:p-7">
      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-500/10 px-4 py-3 text-[13px] font-medium text-danger-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
        </p>
      )}

      <label className={label}>
        {f.name}
        <Input name="name" required defaultValue={campaign?.name} placeholder={f.namePlaceholder} className="mt-1.5" data-testid="campaign-name" />
      </label>

      <div>
        <p className={label}>{f.channel}</p>
        <input type="hidden" name="channel" value={channel} />
        <div role="radiogroup" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={channel === c}
              data-testid={`channel-${c}`}
              onClick={() => setChannel(c)}
              className={cn(
                'rounded-2xl border px-3 py-2.5 text-[13px] font-semibold transition-colors',
                channel === c ? 'border-brand-500 ring-2 ring-brand-500/25' : 'border-hairline hover:border-brand-500/40',
              )}
            >
              <span className={cn('inline-block rounded-full px-2 py-0.5', CHANNEL_TONE[c])}>{m.channel[c]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <label className={label}>
          {f.project}
          <Select name="projectId" defaultValue={campaign?.projectId ?? ''} className="mt-1.5">
            <option value="">{f.none}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{tx(p.name, locale)}</option>)}
          </Select>
          <span className="mt-1 block text-[11.5px] font-normal text-slate-500">{f.projectHint}</span>
        </label>
        <label className={label}>
          {f.source}
          <Select name="sourceId" defaultValue={campaign?.sourceId ?? ''} className="mt-1.5">
            <option value="">{f.none}</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{tx(s.name, locale)}</option>)}
          </Select>
          <span className="mt-1 block text-[11.5px] font-normal text-slate-500">{f.sourceHint}</span>
        </label>
        <label className={label}>
          {f.start}
          <Input type="date" name="startDate" defaultValue={day(campaign?.startDate)} className="mt-1.5" />
        </label>
        <label className={label}>
          {f.end}
          <Input type="date" name="endDate" defaultValue={day(campaign?.endDate)} className="mt-1.5" />
        </label>
        <label className={label}>
          {f.budget}
          <Input type="number" name="budget" min={0} step="0.01" defaultValue={campaign?.budget ?? ''} className="mt-1.5" dir="ltr" />
          <span className="mt-1 block text-[11.5px] font-normal text-slate-500">{f.budgetHint}</span>
        </label>
        <label className={label}>
          {f.status}
          <Select name="status" defaultValue={campaign?.status ?? 'ACTIVE'} className="mt-1.5">
            {STATUSES.map((s) => <option key={s} value={s}>{m.status[s]}</option>)}
          </Select>
        </label>
      </div>

      {!campaign && (
        <label className={label}>
          {f.code}
          <Input name="code" dir="ltr" placeholder="summer-offer" pattern="[a-z0-9][a-z0-9_-]{1,59}" className="mt-1.5 font-mono" />
          <span className="mt-1 block text-[11.5px] font-normal text-slate-500">{f.codeHint}</span>
        </label>
      )}

      <label className={label}>
        {f.notes}
        <Textarea name="notes" rows={3} defaultValue={campaign?.notes ?? ''} className="mt-1.5" />
      </label>

      <div className="flex items-center justify-end gap-2 border-t border-hairline pt-5">
        <Link href={(campaign ? `/dashboard/campaigns/${campaign.id}` : '/dashboard/campaigns') as never}>
          <Button type="button" variant="ghost" size="md">{f.cancel}</Button>
        </Link>
        <Button type="submit" variant="primary" size="md" disabled={pending} data-testid="campaign-save">{f.save}</Button>
      </div>
    </form>
  );
}
