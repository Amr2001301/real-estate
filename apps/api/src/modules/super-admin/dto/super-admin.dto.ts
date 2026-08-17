import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

export class CreateCompanyDto {
  name!: string;
  slug!: string;
  country?: string;
  currency?: string;
  timezone?: string;
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStartAt?: string;
  subscriptionEndAt?: string;
  maxUsers?: number;
  // Optional first admin user
  adminEmail?: string;
  adminPassword?: string;
  adminFullName?: string;
}

export class UpdateCompanyDto {
  name?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionStartAt?: string | null;
  subscriptionEndAt?: string | null;
  maxUsers?: number | null;
  isActive?: boolean;
}

export class CancelCompanyDto {
  immediate!: boolean;
  reason?: string;
}

export class CreateCompanyAdminDto {
  email!: string;
  password!: string;
  fullName!: string;
}
