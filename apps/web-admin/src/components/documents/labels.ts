import type { DocumentCategory, DocumentOwnerType, DocumentVisibility } from '@/lib/types';

export const OWNER_TYPE_LABEL: Record<DocumentOwnerType, string> = {
  PROJECT: 'مشروع',
  UNIT: 'وحدة',
  LEAD: 'فرصة',
  RESERVATION: 'حجز',
  CONTRACT: 'عقد',
  DEPOSIT: 'دفعة',
  BROKER: 'وسيط',
  BROKER_COMMISSION: 'عمولة وسيط',
  BROKER_PAYOUT: 'دفعة وسيط',
  USER: 'مستخدم',
  OTHER: 'أخرى',
};

export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  IMAGE: 'صورة',
  CONTRACT: 'عقد',
  RECEIPT: 'إيصال',
  INVOICE: 'فاتورة',
  BROKER_AGREEMENT: 'اتفاقية وسيط',
  COMMISSION_STATEMENT: 'كشف عمولة',
  PAYOUT_RECEIPT: 'إيصال دفعة',
  ID_DOCUMENT: 'مستند هوية',
  LEGAL: 'قانوني',
  FINANCIAL: 'مالي',
  OTHER: 'أخرى',
};

export const VISIBILITY_LABEL: Record<DocumentVisibility, string> = {
  ADMIN_ONLY: 'مدير فقط',
  BROKER_VISIBLE: 'مرئي للوسيط',
  CUSTOMER_VISIBLE: 'مرئي للعميل',
};

/** Build a link to the owner entity's admin detail page when one exists. */
export function ownerHref(ownerType: DocumentOwnerType, ownerId: string): string | null {
  switch (ownerType) {
    case 'PROJECT':
      return `/dashboard/projects/${ownerId}`;
    case 'UNIT':
      return `/dashboard/units/${ownerId}`;
    case 'LEAD':
      return `/dashboard/leads/${ownerId}`;
    case 'RESERVATION':
      return `/dashboard/reservations/${ownerId}`;
    case 'CONTRACT':
      return `/dashboard/contracts/${ownerId}`;
    case 'BROKER':
      return `/dashboard/brokers/${ownerId}`;
    case 'BROKER_COMMISSION':
      return `/dashboard/broker-commissions/${ownerId}`;
    case 'BROKER_PAYOUT':
      return `/dashboard/broker-payouts/${ownerId}`;
    case 'USER':
      return `/dashboard/users`;
    case 'DEPOSIT':
    case 'OTHER':
      return null;
  }
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}
