-- F4: a company created on a paid plan was stored with status TRIAL and
-- listed as «تجريبي». A paid-plan company still on TRIAL is subscribed.
UPDATE "Company" SET "subscriptionStatus" = 'ACTIVE'
WHERE "subscriptionStatus" = 'TRIAL' AND "subscriptionPlan" <> 'TRIAL';
