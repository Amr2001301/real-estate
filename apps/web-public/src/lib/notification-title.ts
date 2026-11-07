/**
 * templateCode → Arabic label: the fallback for a notification the server did
 * not title (it renders `title` / `body` itself). Unknown codes fall back to
 * "إشعار جديد".
 */

import type { Locale } from '@/lib/locale';
import { accountT } from '@/messages/account';

/** The label for a template code when the server sent none; wording in messages/account.ts. */
export function notificationTitle(code: string, serverTitle?: string, locale: Locale = 'ar'): string {
  // The server's title is in the reader's language and names the unit,
  // contract or amount; the label map is only a fallback.
  if (serverTitle && serverTitle !== code) return serverTitle;
  const t = accountT(locale);
  return t.notificationTitles[code] ?? t.newNotification;
}
