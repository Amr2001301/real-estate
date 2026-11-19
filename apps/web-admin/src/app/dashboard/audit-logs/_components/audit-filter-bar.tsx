'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PremiumFilterBar, PremiumFilterField, PremiumFilterAdvancedPanel, PremiumFilterAdvancedToggle } from '@/components/premium/filter-bar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { uiT } from '@/messages/ui';
import type { Locale } from '@/lib/locale';


interface Props {
  defaultQ?: string;
  defaultAction?: string;
  defaultEntityType?: string;
  defaultActorId?: string;
  defaultFrom?: string;
  defaultTo?: string;
  locale?: Locale;
}

export function AuditFilterBar({
  defaultQ        = '',
  defaultAction   = '',
  defaultEntityType = '',
  defaultActorId  = '',
  defaultFrom     = '',
  defaultTo       = '',
  locale          = 'ar',
}: Props) {
  const m = uiT(locale).auditFilterBar;
  const router = useRouter();

  const [q,          setQ]          = useState(defaultQ);
  const [action,     setAction]     = useState(defaultAction);
  const [entityType, setEntityType] = useState(defaultEntityType);
  const [actorId,    setActorId]    = useState(defaultActorId);
  const [from,       setFrom]       = useState(defaultFrom);
  const [to,         setTo]         = useState(defaultTo);

  // Open advanced panel automatically if any advanced field already has a value.
  const [showAdvanced, setShowAdvanced] = useState(
    !!(defaultEntityType || defaultActorId || defaultFrom || defaultTo),
  );

  const hasAdvanced = !!(entityType || actorId || from || to);

  function buildQuery(): string {
    const p = new URLSearchParams();
    if (q)          p.set('q', q);
    if (action)     p.set('action', action);
    if (entityType) p.set('entityType', entityType);
    if (actorId)    p.set('actorId', actorId);
    if (from)       p.set('from', from);
    if (to)         p.set('to', to);
    const qs = p.toString();
    return qs ? `?${qs}` : '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/dashboard/audit-logs${buildQuery()}`);
  }


  return (
    <PremiumFilterBar
      autoSubmit={false}
      onSubmit={handleSubmit}
      trailing={
        <>
          <PremiumFilterAdvancedToggle
            onClick={() => setShowAdvanced((v) => !v)}
            open={showAdvanced}
            active={hasAdvanced}
            label={showAdvanced ? m.advancedHide : m.advancedShow}
          />
        </>
      }
    >
      <PremiumFilterField label={m.searchPlaceholder} htmlFor="audit-q">
        <Input id="audit-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.searchPlaceholder} />
      </PremiumFilterField>

      <PremiumFilterField label={m.actionAriaLabel} htmlFor="audit-action">
        <Select id="audit-action" inputSize="sm" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">{m.allActions}</option>
          <option value="POST">{m.actionPost}</option>
          <option value="PATCH">{m.actionPatch}</option>
          <option value="PUT">{m.actionPut}</option>
          <option value="DELETE">{m.actionDelete}</option>
        </Select>
      </PremiumFilterField>

      {showAdvanced && (
        <PremiumFilterAdvancedPanel>
          <PremiumFilterField label={m.areaLabel} htmlFor="audit-area">
            <Input id="audit-area" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder={m.areaPlaceholder} dir="ltr" />
          </PremiumFilterField>
          <PremiumFilterField label={m.fromDateLabel} htmlFor="audit-from">
            <input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={m.fromDateAriaLabel} />
          </PremiumFilterField>
          <PremiumFilterField label={m.toDateLabel} htmlFor="audit-to">
            <input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={m.toDateAriaLabel} />
          </PremiumFilterField>
          <PremiumFilterField label={m.actorIdLabel} htmlFor="audit-actor">
            <Input id="audit-actor" value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder={m.actorIdPlaceholder} dir="ltr" />
          </PremiumFilterField>
        </PremiumFilterAdvancedPanel>
      )}
    </PremiumFilterBar>
  );
}
