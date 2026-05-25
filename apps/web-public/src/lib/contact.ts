/**
 * Contact-link helpers driven entirely by env — NO hardcoded production
 * numbers. When a number is unset the caller hides the corresponding button.
 *
 *   NEXT_PUBLIC_CONTACT_PHONE  → Call (tel:) button
 *   NEXT_PUBLIC_WHATSAPP_PHONE → WhatsApp (wa.me) button
 *
 * Both are NEXT_PUBLIC_ so they resolve in server and client components alike.
 */

function clean(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/** Configured phone for the Call button, or null when unset. */
export function getContactPhone(): string | null {
  return clean(process.env.NEXT_PUBLIC_CONTACT_PHONE);
}

/** Configured phone for the WhatsApp button, or null when unset. */
export function getWhatsappPhone(): string | null {
  return clean(process.env.NEXT_PUBLIC_WHATSAPP_PHONE);
}

/** `tel:` link — keeps a leading +, strips spaces/dashes/parentheses. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[\s()-]/g, '')}`;
}

/** wa.me link — digits only (drops +/separators); optional prefilled text. */
export function whatsappHref(phone: string, message?: string): string {
  const base = `https://wa.me/${phone.replace(/\D/g, '')}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
