/**
 * Central route map for the public website. Pages that don't exist yet (W3+)
 * still resolve here so the nav/footer can link to stable hrefs.
 */
export const routes = {
  home: '/',
  projects: '/projects',
  project: (id: string) => `/projects/${id}`,
  units: '/units',
  unit: (id: string) => `/units/${id}`,
  compare: '/compare',
  contact: '/contact',
  app: '/app',
  account: '/account',
  accountProfile: '/account/profile',
  accountFavorites: '/account/favorites',
  accountVisits: '/account/visits',
  accountRequests: '/account/requests',
  accountReservations: '/account/reservations',
  // Customer-only (post-purchase) sections.
  accountProperty: '/account/property',
  accountInstallments: '/account/installments',
  accountContracts: '/account/contracts',
  accountDeposits: '/account/deposits',
  accountMaintenance: '/account/maintenance',
  accountMaintenanceNew: '/account/maintenance/new',
  accountNotifications: '/account/notifications',
  accountDocuments: '/account/documents',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  privacy: '/privacy',
  terms: '/terms',
} as const;

export interface NavItem {
  label: string;
  href: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { label: 'الرئيسية', href: routes.home },
  { label: 'المشاريع', href: routes.projects },
  { label: 'الوحدات', href: routes.units },
  { label: 'المقارنة', href: routes.compare },
  { label: 'تواصل معنا', href: routes.contact },
];
