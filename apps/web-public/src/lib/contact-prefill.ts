import { getSession } from '@/lib/session';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { MeProfile } from '@/lib/api-types';
import type { ContactPrefill } from '@/components/contact/ContactForm';

/**
 * Best-effort server-side prefill for the public contact / visit form.
 *
 * Returns `undefined` for guests (so the form renders empty with no network
 * cost) and for any failure path — never throws, never surfaces a raw error.
 * For logged-in users, returns whatever subset of `fullName / phone / email`
 * the profile actually has; missing fields stay editable in the form.
 *
 * Lives in lib (not in each page) so the contact page and the homepage
 * lead-band use identical logic.
 */
export async function resolveContactPrefill(): Promise<ContactPrefill | undefined> {
  const session = await getSession();
  if (!session) return undefined;

  try {
    const me = await authFetch<MeProfile>('/users/me');
    const out: ContactPrefill = {};
    if (me.fullName) out.fullName = me.fullName;
    if (me.phone) out.phone = me.phone;
    if (me.email) out.email = me.email;
    return out;
  } catch (e) {
    // AuthError (cookie present but stale token) or any other failure:
    // silently fall back to an empty prefill. The form still works, the user
    // can type, and no backend detail leaks through.
    if (e instanceof AuthError) return undefined;
    return undefined;
  }
}
