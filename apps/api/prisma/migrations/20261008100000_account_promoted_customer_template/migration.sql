-- FG-14 (docs/audit/08-functional-gaps.md): a client promoted to customer by
-- their first contract has their sessions revoked; this notification tells
-- them why. Platform default (companyId NULL) — the seed creates the same row
-- for new databases; a company override, if any, is left alone.
INSERT INTO "NotificationTemplate" ("id", "code", "channel", "subject", "body", "active", "emailEnabled", "createdAt", "updatedAt", "companyId")
VALUES (
  gen_random_uuid(),
  'account_promoted_customer',
  'PUSH',
  '{"ar": "تمت ترقية حسابك إلى حساب عميل", "en": "Your account is now a customer account"}'::jsonb,
  '{"ar": "بعد إنشاء عقد الوحدة {{unitCode}} أصبح حسابك حساب عميل. سجّل الدخول مرة أخرى لتظهر لك العقود والأقساط.", "en": "With the contract for unit {{unitCode}}, your account is now a customer account. Sign in again to see your contracts and installments."}'::jsonb,
  true,
  true,
  NOW(),
  NOW(),
  NULL
)
ON CONFLICT ("companyId", "code") DO NOTHING;
