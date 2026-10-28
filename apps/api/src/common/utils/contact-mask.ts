/**
 * A customer's phone or e-mail for someone who may not have it (MP1): a
 * sales rep sees full contact details only on their own leads.
 * "+201001234567" → "+2010•••••4567"; "ahmed@site.com" → "a•••@site.com".
 */
export function maskPhone(phone: string | null | undefined): string | null | undefined {
  if (!phone) return phone;
  const digits = phone.replace(/\s+/g, '');
  if (digits.length <= 6) return '•'.repeat(digits.length);
  return `${digits.slice(0, 5)}${'•'.repeat(Math.max(3, digits.length - 9))}${digits.slice(-4)}`;
}

export function maskEmail(email: string | null | undefined): string | null | undefined {
  if (!email) return email;
  const at = email.indexOf('@');
  if (at < 1) return '•••';
  return `${email[0]}•••${email.slice(at)}`;
}

/** True when the value is a masked one (no call, no copy). */
export function isMasked(value: string | null | undefined): boolean {
  return !!value && value.includes('•');
}
