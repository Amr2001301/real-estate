import { ForbiddenException } from '@nestjs/common';
import type { CompanyLifecycleStatus, Prisma, SubscriptionStatus } from '@prisma/client';

/** Subscription states in which the company's platform is switched off. */
export const BLOCKED_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['SUSPENDED', 'CANCELLED', 'EXPIRED'];

/**
 * One rule for "may this company be used": its lifecycle is ACTIVE (an
 * administrative switch) and its subscription is not suspended, cancelled or
 * expired (billing). Logins checked both, but token refresh, every request,
 * the customer app, the public site and the automatic notifications checked
 * only the lifecycle — a suspended or expired company kept working.
 */
export const ACCESSIBLE_COMPANY_WHERE = {
  lifecycleStatus: 'ACTIVE',
  subscriptionStatus: { notIn: BLOCKED_SUBSCRIPTION_STATUSES },
} satisfies Prisma.CompanyWhereInput;

export function companyAccessAllowed(
  c: { lifecycleStatus: CompanyLifecycleStatus; subscriptionStatus: SubscriptionStatus } | null | undefined,
): boolean {
  return !!c && c.lifecycleStatus === 'ACTIVE' && !BLOCKED_SUBSCRIPTION_STATUSES.includes(c.subscriptionStatus);
}

/** The error a blocked company's users get (same shape as before: COMPANY_NOT_ACTIVE). */
export function companyAccessDenied(): ForbiddenException {
  return new ForbiddenException({ message: 'Company access is currently disabled', code: 'COMPANY_NOT_ACTIVE' });
}
