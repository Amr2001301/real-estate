import { routes } from '@/lib/routes';

/**
 * Single source of truth for mapping a notification's payload → a customer
 * portal URL. Handles BOTH the newer payload shape (entityType / entityId /
 * action — added in Gap 3) and the legacy per-entity id keys that older
 * notifications carry (reservationId, depositId, contractId, installmentId,
 * maintenanceRequestId, visitId / appointmentId / requestId).
 *
 * Defensive by design: a null/non-object payload, or one with no recognizable
 * target, returns `null` so the caller renders the row without a link rather
 * than crashing or guessing.
 *
 * NOTE on `requestId`: in this codebase `requestId` denotes a VISIT request
 * (see the visit_* notification payloads), NOT a maintenance request — so it
 * maps to /account/visits. Maintenance deep-links require the explicit
 * `maintenanceRequestId` key or `entityType: 'maintenance'`.
 */
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function notificationHref(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  // 1) Newer payloads: explicit entityType wins (entityId carries the id).
  const entityType = str(p.entityType);
  const entityId = str(p.entityId);
  switch (entityType) {
    case 'maintenance': {
      const mid = entityId ?? str(p.maintenanceRequestId);
      return mid ? `${routes.accountMaintenance}/${mid}` : routes.accountMaintenance;
    }
    case 'reservation':
      return routes.accountReservations;
    case 'deposit':
      return routes.accountDeposits;
    case 'installment':
      return routes.accountInstallments;
    case 'contract':
      return routes.accountContracts;
    case 'visit':
      return routes.accountVisits;
    default:
      break;
  }

  // 2) Legacy id keys, most specific first. Order matters when several are
  //    present (e.g. a deposit notification also carries contractId).
  if (str(p.reservationId)) return routes.accountReservations;
  if (str(p.depositId)) return routes.accountDeposits;
  if (str(p.installmentId)) return routes.accountInstallments;
  if (str(p.contractId)) return routes.accountContracts;
  const maintenanceId = str(p.maintenanceRequestId);
  if (maintenanceId) return `${routes.accountMaintenance}/${maintenanceId}`;
  if (str(p.visitId) || str(p.appointmentId) || str(p.requestId)) return routes.accountVisits;

  return null;
}
