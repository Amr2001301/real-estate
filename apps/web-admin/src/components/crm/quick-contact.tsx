'use client';

import type { MouseEvent, PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Phone } from 'lucide-react';
import { cn } from '@/lib/cn';
import { whatsappHref } from './follow-up-messages';
import { contactLeadAction } from '@/app/dashboard/leads/actions';

/**
 * A call or WhatsApp button for a lead: it fetches the number when pressed
 * (the press is logged on the lead — MP1), opens the dialer or the chat,
 * then brings the lead page up with the activity form set to that kind —
 * so the rep logs how it went while it is fresh. Works inside a card that is
 * itself a link or a drag handle (the click and the drag stop here).
 */
export function QuickContact({
  leadId,
  phone,
  kind,
  label,
  variant = 'icon',
  className,
}: {
  leadId: string;
  /** Shown on hover only; the number dialled comes from the server. */
  phone?: string;
  kind: 'CALL' | 'WHATSAPP';
  label: string;
  variant?: 'icon' | 'button';
  className?: string;
}) {
  const router = useRouter();
  const Icon = kind === 'CALL' ? Phone : MessageCircle;

  const onClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // The chat tab opens now, while the click still counts as the user's;
    // it is pointed at the chat once the number is in.
    const chat = kind === 'WHATSAPP' ? window.open('', '_blank') : null;
    if (chat) chat.opener = null;
    const res = await contactLeadAction(leadId, kind);
    if (!res.phone) {
      chat?.close();
      return;
    }
    if (chat) chat.location.href = whatsappHref(res.phone);
    else window.location.href = `tel:${res.phone}`;
    // Let the dialer / chat take over first, then open the log on the lead.
    window.setTimeout(() => router.push(`/dashboard/leads/${leadId}?log=${kind}&t=${Date.now()}#activity` as never), 400);
  };
  const stop = (e: PointerEvent) => e.stopPropagation();

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={stop}
      aria-label={label}
      title={variant === 'icon' ? (phone ? `${label} · ${phone}` : label) : undefined}
      data-testid={`quick-${kind === 'CALL' ? 'call' : 'whatsapp'}`}
      className={cn(
        variant === 'icon'
          ? 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface transition-colors hover:border-brand-500/50'
          : 'inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-[13.5px] font-semibold text-slate-700 transition-colors hover:border-brand-500/50 hover:text-slate-900',
        kind === 'WHATSAPP' ? 'text-emerald-600' : variant === 'icon' && 'text-slate-700 hover:text-brand-700',
        className,
      )}
    >
      <Icon className={variant === 'icon' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
      {variant === 'button' && label}
    </button>
  );
}
