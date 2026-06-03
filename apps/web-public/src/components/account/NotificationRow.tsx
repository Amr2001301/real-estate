'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useTransition } from 'react';
import { markNotificationReadAction } from '@/lib/account-actions';

/**
 * Interactive shell for one notification row. The visual content (`children`)
 * is rendered by the server NotificationCard; this client wrapper only decides
 * the affordance:
 *   - has a deep-link route  → <Link> (marks read on click when unread, then
 *                              navigates to the related page)
 *   - unread, no route       → <button> that marks read on click
 *   - read, no route         → plain <div>
 *
 * Marking read is fire-and-forget inside a transition so navigation isn't
 * blocked; the server action revalidates the account layout/page so the unread
 * badge and the row state refresh.
 */
export function NotificationRow({
  id,
  href,
  unread,
  className,
  children,
}: {
  id: string;
  href: string | null;
  unread: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const [, startTransition] = useTransition();

  const markRead = () => {
    if (unread) startTransition(() => void markNotificationReadAction(id));
  };

  if (href) {
    return (
      <Link href={href as Route} onClick={markRead} className={className}>
        {children}
      </Link>
    );
  }

  if (unread) {
    return (
      <button type="button" onClick={markRead} aria-label="تحديد كمقروء" className={className}>
        {children}
      </button>
    );
  }

  return <div className={className}>{children}</div>;
}
