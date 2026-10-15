/// The one mapping from a notification to a staff-app screen, shared by the
/// notification list and push taps so the same notice always opens the same
/// place. A broker user gets the broker portal's screens.
///
/// [code] is the templateCode; [data] is the notification payload (in-app) or
/// the push data map. Returns null when no screen applies.
String? staffNotificationRoute(
  String code,
  Map<String, dynamic> data, {
  bool isBroker = false,
}) {
  String? str(String key) {
    final v = data[key];
    return v is String && v.isNotEmpty ? v : null;
  }

  final entityType = str('entityType');
  // The entity's own id, only when the payload says what it is.
  String? idOf(String type, String legacyKey) =>
      (entityType == type ? str('entityId') : null) ?? str(legacyKey);

  if (isBroker) {
    if (code.startsWith('broker_commission_') || code.startsWith('broker_payout_')) {
      return '/broker/commissions';
    }
    if (code.contains('reservation') || entityType == 'reservation') {
      final id = idOf('reservation', 'reservationId');
      return id != null ? '/broker/reservations/$id' : '/broker/home';
    }
    if (code.contains('lead') || entityType == 'lead') {
      final id = idOf('lead', 'leadId');
      return id != null ? '/broker/leads/$id' : '/broker/home';
    }
    return '/broker/home';
  }

  if (code.startsWith('maintenance_') || entityType == 'maintenance') {
    final id = idOf('maintenance', 'requestId');
    return id != null ? '/maintenance/$id' : '/maintenance';
  }
  if (code.startsWith('payment_proof_') || code.startsWith('booking_payment_proof_')) {
    return '/payments-review';
  }
  if (code.startsWith('deposit_') || code.startsWith('cheque_') || entityType == 'deposit') {
    return '/deposits';
  }
  if (code.startsWith('bonus_') || entityType == 'bonus') return '/bonus';
  if (code.startsWith('visit_') || entityType == 'visit' || entityType == 'visit_request') {
    // Only an appointment id opens the visit itself; a request has no screen.
    final id = idOf('visit', 'visitId');
    return id != null ? '/visits/$id' : '/visits';
  }
  if (code.startsWith('reservation_') || entityType == 'reservation') {
    final id = idOf('reservation', 'reservationId');
    return id != null ? '/reservations/$id' : '/reservations';
  }
  if (code.startsWith('lead_') || code.startsWith('broker_lead_') || entityType == 'lead') {
    final id = idOf('lead', 'leadId');
    return id != null ? '/leads/$id' : '/leads';
  }
  // Contracts, and installment notices filed under their contract.
  if (code.startsWith('contract_') || code.startsWith('installment_') || entityType == 'contract') {
    final id = idOf('contract', 'contractId');
    return id != null ? '/contracts/$id' : '/contracts';
  }
  return null;
}
