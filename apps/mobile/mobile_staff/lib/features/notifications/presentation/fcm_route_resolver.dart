import 'package:firebase_messaging/firebase_messaging.dart';

/// Maps an FCM [RemoteMessage] to an in-app navigation route for the Staff App.
///
/// Data keys (set by the backend):
///  - `templateCode` — notification type
///  - `entityType`   — e.g. "maintenance", "lead", "visit"
///  - `entityId`     — UUID of the target entity
///
/// Returns null when no specific screen applies.
String? resolveStaffFcmRoute(RemoteMessage message) {
  final data = message.data;
  final code = data['templateCode'] as String? ?? '';
  final entityType = data['entityType'] as String?;
  final entityId = data['entityId'] as String?;

  if (code.startsWith('maintenance_') || entityType == 'maintenance') {
    final id = entityId;
    if (id != null && id.isNotEmpty) return '/maintenance/$id';
    return '/maintenance';
  }
  if (code.startsWith('visit_') || entityType == 'visit') {
    final id = entityId;
    if (id != null && id.isNotEmpty) return '/visits/$id';
    return '/visits';
  }
  if (code.startsWith('reservation_') || entityType == 'reservation') {
    final id = entityId;
    if (id != null && id.isNotEmpty) return '/reservations/$id';
    return '/reservations';
  }
  if (code.startsWith('lead_') || entityType == 'lead') {
    final id = entityId;
    if (id != null && id.isNotEmpty) return '/leads/$id';
    return '/leads';
  }
  if (code.startsWith('broker_lead_') ||
      code.startsWith('broker_commission_') ||
      code.startsWith('broker_payout_')) {
    return '/broker/commissions';
  }
  if (code.startsWith('payment_proof_') || code.startsWith('booking_payment_proof_')) {
    return '/payments-review';
  }
  return null;
}
