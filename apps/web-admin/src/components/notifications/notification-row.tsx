'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { markNotificationReadAction } from '@/app/_actions/notifications';

/**
 * Interactive shell for one admin notification row. The visual content
 * (`children`) is rendered by the server NotificationList; this wrapper only
 * decides the affordance:
 *   - has a deep-link route → <Link> (marks read on click, then navigates)
 *   - unread, no route       → <button> that marks read on click
 *   - read, no route         → plain <div>
 * Marking read is fire-and-forget in a transition so navigation isn't blocked;
 * the server action revalidates so the bell/badge refresh.
 */
export function AdminNotificationRow({
  id,
  href,
  unread,
  basePath,
  className,
  children,
}: {
  id: string;
  href: string | null;
  unread: boolean;
  basePath: '/dashboard' | '/portal';
  className: string;
  children: React.ReactNode;
}) {
  const [, startTransition] = useTransition();

  const markRead = () => {
    if (!unread) return;
    const fd = new FormData();
    fd.set('id', id);
    fd.set('basePath', basePath);
    startTransition(() => void markNotificationReadAction(fd));
  };

  if (href) {
    return (
      <Link href={href as never} onClick={markRead} className={className}>
        {children}
      </Link>
    );
  }
  if (unread) {
    return (
      <button type="button" onClick={markRead} aria-label="تعليم كمقروء" className={className}>
        {children}
      </button>
    );
  }
  return <div className={className}>{children}</div>;
}
