import type { uiT } from '@/messages/ui';

type AreaLabels = ReturnType<typeof uiT>['operationsPage']['areaLabels'];

/** The area an audit event belongs to, by its entity type ("deposits" → payments). */
export function areaLabel(entityType: string, labels: AreaLabels): string {
  const et = entityType.toLowerCase();
  if (et.includes('auth'))               return labels.auth;
  if (et.includes('permission'))         return labels.permission;
  if (et.includes('broker-lead'))        return labels.brokerLead;
  if (et.includes('broker-reservation')) return labels.brokerReservation;
  if (et.includes('broker-contract'))    return labels.brokerContract;
  if (et.includes('broker-commission'))  return labels.brokerCommission;
  if (et.includes('broker-payout'))      return labels.brokerPayout;
  if (et.includes('broker'))             return labels.broker;
  if (et.includes('user'))               return labels.user;
  if (et.includes('reservation'))        return labels.reservation;
  if (et.includes('contract'))           return labels.contract;
  if (et.includes('payment'))            return labels.payment;
  if (et.includes('lead'))               return labels.lead;
  if (et.includes('project'))            return labels.project;
  if (et.includes('unit'))               return labels.unit;
  if (et.includes('maintenance'))        return labels.maintenance;
  if (et.includes('document'))           return labels.document;
  if (et.includes('visit'))              return labels.visit;
  if (et.includes('notification'))       return labels.notification;
  if (et.includes('audit'))              return labels.auditLog;
  if (et.includes('setting') || et.includes('company')) return labels.setting;
  if (et.includes('sales-target'))       return labels.salesTarget;
  if (et.includes('bonus'))              return labels.bonus;
  if (et.includes('report'))             return labels.report;
  if (et.includes('installment'))        return labels.installment;
  if (et.includes('deposit'))            return labels.deposit;
  if (et.includes('balance'))            return labels.balance;
  if (et.includes('target'))             return labels.target;
  return labels.unclassified;
}
