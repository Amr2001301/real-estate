/**
 * Lightweight, browser-only reader for the non-httpOnly `user` cookie.
 *
 * UI HINT ONLY. This exists so the (client) Navbar can show a signed-in state
 * without forcing every page to render dynamically. It is NOT a security
 * boundary — never gate protected content on it. The httpOnly access_token
 * (unreadable here) and the backend guards are the real authority.
 */
export interface ClientUser {
  id: string;
  role: string;
  fullName: string;
}

export function readClientUser(): ClientUser | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('user='));
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match.slice('user='.length));
    const parsed = JSON.parse(raw) as Partial<ClientUser>;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.role !== 'string') {
      return null;
    }
    return {
      id: parsed.id,
      role: parsed.role,
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
    };
  } catch {
    return null;
  }
}
