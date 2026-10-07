import { BadRequestException } from '@nestjs/common';
import { canonicalPhone } from './identity-normalize';

/**
 * FG-21 — the one rule for any `User.phone` a service is about to write.
 *
 * OTP login looks users up by the E.164 form (`canonicalPhone` in
 * AuthService). Before this, eight create paths and three update paths stored
 * the phone exactly as typed, so a CLIENT created from a lead as `01062800394`
 * could never be found by OTP — logging in made a second, empty account and
 * the first one kept every lead, reservation and contract. See
 * docs/audit/08-functional-gaps.md FG-20 / FG-21.
 *
 * Same parse as auth: E.164 first, then the company's country, falling back to
 * EG exactly as TenantResolverService does when Company.country is null.
 *
 *   undefined           → undefined  (an update that does not touch the phone)
 *   null / blank        → null       (explicitly no phone)
 *   parseable           → E.164
 *   anything else       → 400. Storing it verbatim is what caused the split;
 *                         an unparseable phone is not an identity key.
 */
export async function phoneForWrite(
  db: { company: { findUnique(args: { where: { id: string }; select: { country: true } }): Promise<{ country: string | null } | null> } },
  raw: string | null | undefined,
  companyId: string | null | undefined,
): Promise<string | null | undefined> {
  if (raw === undefined) return undefined;
  if (raw === null || raw.trim() === '') return null;

  const e164 = canonicalPhone(raw);
  if (e164) return e164;

  const company = companyId
    ? await db.company.findUnique({ where: { id: companyId }, select: { country: true } })
    : null;
  const local = canonicalPhone(raw, company?.country ?? 'EG');
  if (local) return local;

  throw new BadRequestException(
    'Invalid phone number — provide a valid E.164 (+CC…) or local mobile number',
  );
}
