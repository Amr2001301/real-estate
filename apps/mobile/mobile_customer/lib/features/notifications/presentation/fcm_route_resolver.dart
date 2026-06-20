import 'package:firebase_messaging/firebase_messaging.dart';

/// Maps an FCM [RemoteMessage] to an in-app navigation route.
///
/// The backend sends two data keys in every push:
///  - `templateCode` — identifies the notification type
///  - `notificationId` — DB row id (reserved for future use)
///
/// Optional deep-link keys (added by the backend when present):
///  - `entityType` — e.g. "maintenance", "contract", "deposit"
///  - `entityId`   — UUID of the target entity
///
/// Returns null when no specific screen applies (navigator stays on current
/// route; user can open the notification list to see the new item).
String? resolveFcmRoute(RemoteMessage message) {
  final data = message.data;
  final code = data['templateCode'] as String? ?? '';
  final entityType = data['entityType'] as String?;
  final entityId = data['entityId'] as String?;

  // Maintenance
  if (code.startsWith('maintenance_') || entityType == 'maintenance') {
    if (entityId != null && entityId.isNotEmpty) return '/account/maintenance/$entityId';
    return '/account/maintenance';
  }
  // Contracts
  if (code.startsWith('contract_') ||
      code == 'broker_contract_signed' ||
      code == 'broker_contract_created' ||
      entityType == 'contract') {
    if (entityId != null && entityId.isNotEmpty) return '/account/contracts/$entityId';
    return '/account/contracts';
  }
  // Deposits / payment proofs
  if (code.startsWith('deposit_') ||
      code == 'payment_proof_approved' ||
      code == 'payment_proof_rejected' ||
      entityType == 'deposit') {
    if (entityId != null && entityId.isNotEmpty) return '/account/deposits/$entityId';
    return '/account/deposits';
  }
  // Installments
  if (code.startsWith('installment_') || code.startsWith('payment_proof_')) {
    if (entityId != null && entityId.isNotEmpty) return '/account/installments/$entityId/proof';
    return '/account/installments';
  }
  // Visits
  if (code.startsWith('visit_')) return '/account/requests';
  // Reservations
  if (code.startsWith('reservation_')) return '/account/finance';

  return null;
}
