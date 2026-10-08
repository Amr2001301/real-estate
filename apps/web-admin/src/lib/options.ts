import { api } from './api';
import type { BrokerStatus, ProjectStatus, Translatable, UserRole } from './types';

/**
 * Dropdown and filter options (server components only).
 *
 * These pages used to fill their <select>s from ?pageSize=100–500 *full*
 * rows of projects, brokers and staff — relations, unit aggregates, facets —
 * and silently lost every option past that page. The /options endpoints
 * return every row of the company, a few columns each (API:
 * common/utils/options.ts). /users/options also lists staff to SALES and
 * SALES_MANAGER, who get 403 from GET /users — their sales-rep dropdowns
 * used to come back empty.
 */
export interface Options<T> {
  data: T[];
  /** The company has more rows than the API's cap (1000); the list is cut. */
  truncated: boolean;
}

export interface ProjectOption {
  id: string;
  name: Translatable;
  city: string;
  status: ProjectStatus;
  featured: boolean;
}

export interface BrokerOption {
  id: string;
  companyName: string;
  commercialName: string | null;
  code: string;
  city: string | null;
  status: BrokerStatus;
  defaultCommissionPct: string | number | null;
}

export interface StaffOption {
  id: string;
  fullName: string;
  role: UserRole;
  active: boolean;
}

/** Roles /users/options accepts. Clients and customers are never options. */
export type StaffRole = Extract<
  UserRole,
  'ADMIN' | 'SALES' | 'SALES_MANAGER' | 'MAINTENANCE_SUPERVISOR'
>;

export function projectOptions() {
  return api.get<Options<ProjectOption>>('/projects/options');
}

export function brokerOptions(status?: BrokerStatus) {
  return api.get<Options<BrokerOption>>(`/brokers/options${status ? `?status=${status}` : ''}`);
}

export function staffOptions(roles: StaffRole[], opts: { active?: boolean } = {}) {
  const qs = new URLSearchParams({ role: roles.join(',') });
  if (opts.active !== undefined) qs.set('active', String(opts.active));
  return api.get<Options<StaffOption>>(`/users/options?${qs.toString()}`);
}
