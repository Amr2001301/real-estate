# ADR-17: Dual-Brand Architecture — Platform vs Tenant

**Date:** 2026-09-24  
**Status:** Decided  
**Applies to:** mobile_staff, mobile_customer, web-admin, web-public

---

## Decision

The platform operates two distinct branding surfaces:

| Surface | Brand shown | Rationale |
|---|---|---|
| Staff-facing (mobile_staff, web-admin) | **Devora** — platform brand | Employees work for Devora; the product is their daily tool |
| Customer-facing (mobile_customer, web-public) | **Tenant** — client's brand | End-users belong to the tenant; they should never see the SaaS layer |

This is the intended product design. It is not a gap or a neutral fallback.

---

## What this means for each surface

### mobile_staff
- Splash screen: `DEVORA` wordmark + `STAFF` subtitle. Deliberately hardcoded.
- Theme: platform navy/gold defaults. Does not load per-tenant `BrandingCubit` tokens.
- FCM channel names: generic (`Push Notifications`, `Notification Sound`) — these appear in Android system settings, not user-visible product UI.

### web-admin
- No tenant logo in the navbar. Platform identity throughout.
- The branding management page (`/dashboard/company/branding`) lets admins set the *tenant's* brand; it does not affect the admin UI itself.

### mobile_customer
- Splash screen: neutral (no `DEVORA` wordmark). Tenant branding loads via `BrandingCubit` after company selection.
- Theme: driven by tenant `BrandTokens` (primaryColor, accentColor). Falls back to platform palette when tokens are null (network failure, no branding configured).

### web-public
- Navbar and footer: tenant `logoUrl` and `displayName` from branding API.
- CSS custom properties `--brand-primary-*` and `--brand-accent-*` injected at layout level from branding response.

---

## What must NOT be changed

- Do not add Devora branding to `mobile_customer` or `web-public`. The customer never sees the platform name.
- Do not remove the `DEVORA` wordmark from `mobile_staff`'s splash screen. It is there deliberately.
- Do not make `mobile_staff` or `web-admin` respond to tenant `BrandingCubit` tokens for their primary chrome. Tenant admins cannot rebrand the tool their employees use.
- FCM channel IDs are stable identifiers (`devora_push`, `devora_sound`) and must not be renamed. Channel *names* (shown in Android settings) are already generic and should stay that way.

---

## Why the staff app stays platform-branded

1. **Product identity.** Sales agents use one app across tenant switches; the tool is always Devora regardless of which company's data they are viewing.
2. **Support surface.** Helpdesk, onboarding, and training materials reference the Devora product. A rebranded staff UI breaks that reference.
3. **Tenant boundary.** A tenant admin should not be able to alter the tool their staff uses — only their own customer-facing surfaces. Allowing tenant branding into `mobile_staff` is a privilege escalation of the branding system.

---

## Related

- `docs/audit/16-branding-isolation-gap.md` — two-tenant hostname isolation gap in local testing
- `apps/mobile/packages/core/lib/src/branding/` — BrandingCubit, BrandTokens, BrandingRepository
- `apps/api/src/modules/company-branding/` — public and admin branding endpoints
