import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * What a code or a name on a page stands for, and the page it opens. Every
 * code shown in the dashboard (unit, contract, reservation, receipt,
 * cheque…) is a link to its own page through this one component.
 */
export type EntityKind =
  | 'unit'
  | 'project'
  | 'reservation'
  | 'contract'
  | 'deposit'
  | 'installment'
  | 'cheque'
  | 'customer'
  | 'client'
  | 'lead'
  | 'broker'
  | 'commission'
  | 'payout'
  | 'maintenance'
  | 'document';

/** The broker portal's own pages; anything else is shown there as plain text. */
const PORTAL: Partial<Record<EntityKind, string>> = {
  reservation: '/portal/reservations',
  contract: '/portal/contracts',
  lead: '/portal/leads',
  commission: '/portal/commissions',
  payout: '/portal/payouts',
};

/**
 * The page of an entity. A cheque has no page of its own: the cheques list,
 * searched by its number. In the broker portal only its own pages exist.
 */
export function entityHref(
  kind: EntityKind,
  id: string,
  code?: string | null,
  scope: 'dashboard' | 'portal' = 'dashboard',
): string | null {
  if (scope === 'portal') return PORTAL[kind] ? `${PORTAL[kind]}/${id}` : null;
  switch (kind) {
    case 'unit':
      return `/dashboard/units/${id}`;
    case 'project':
      return `/dashboard/projects/${id}`;
    case 'reservation':
      return `/dashboard/reservations/${id}`;
    case 'contract':
      return `/dashboard/contracts/${id}`;
    case 'deposit':
      return `/dashboard/deposits/${id}`;
    case 'installment':
      return `/dashboard/installments/${id}`;
    case 'cheque':
      return `/dashboard/cheques?q=${encodeURIComponent(code ?? id)}`;
    case 'customer':
      return `/dashboard/customers/${id}`;
    case 'client':
      return `/dashboard/clients/${id}`;
    case 'lead':
      return `/dashboard/leads/${id}`;
    case 'broker':
      return `/dashboard/brokers/${id}`;
    case 'commission':
      return `/dashboard/broker-commissions/${id}`;
    case 'payout':
      return `/dashboard/broker-payouts/${id}`;
    case 'maintenance':
      return `/dashboard/maintenance/${id}`;
    case 'document':
      return `/dashboard/documents/${id}`;
  }
}

/**
 * A code (or name) that opens its page. Codes keep their look — mono, left
 * to right — and gain a hover underline in the brand colour. Without an id
 * (the row has no target) the text is shown as it is.
 */
export function EntityLink({
  kind,
  id,
  code,
  children,
  mono = true,
  className,
  testId,
  scope = 'dashboard',
}: {
  kind: EntityKind;
  id: string | null | undefined;
  /** The code shown, and searched by for a cheque. Defaults to the children. */
  code?: string | null;
  children?: ReactNode;
  /** Codes are mono and LTR; names are not. */
  mono?: boolean;
  className?: string;
  testId?: string;
  /** In the broker portal, links go to the portal's pages. */
  scope?: 'dashboard' | 'portal';
}) {
  const content = children ?? code ?? '—';
  const look = cn(mono && 'font-mono', className);
  const href = id ? entityHref(kind, id, code, scope) : null;
  if (!href) {
    return (
      <span className={look} dir={mono ? 'ltr' : undefined}>
        {content}
      </span>
    );
  }
  return (
    <Link
      href={href as never}
      dir={mono ? 'ltr' : undefined}
      data-testid={testId ?? `entity-link-${kind}`}
      className={cn(
        look,
        'underline-offset-4 decoration-brand-400/60 transition-colors hover:text-brand-700 hover:underline',
      )}
    >
      {content}
    </Link>
  );
}
