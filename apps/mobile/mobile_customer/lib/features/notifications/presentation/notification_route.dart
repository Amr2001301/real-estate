/// The one mapping from a notification to a customer-app screen, shared by
/// the notification list and push taps so the same notice always opens the
/// same place.
///
/// [code] is the templateCode; [data] is the notification payload (in-app) or
/// the push data map. The item itself opens when the payload names it (the
/// detail screens load it by id); otherwise its list. Returns null when no
/// screen applies.
String? customerNotificationRoute(String code, Map<String, dynamic> data) {
  String? str(String key) {
    final v = data[key];
    return v is String && v.isNotEmpty ? v : null;
  }

  final entityType = str('entityType');
  // The entity's own id, only when the payload says what it is.
  String? idOf(String type, String legacyKey) =>
      (entityType == type ? str('entityId') : null) ?? str(legacyKey);

  if (code.startsWith('maintenance_') || entityType == 'maintenance') {
    final id = idOf('maintenance', 'maintenanceRequestId');
    return id != null ? '/account/maintenance/$id' : '/account/maintenance';
  }
  if (code.startsWith('deposit_') ||
      code.startsWith('cheque_') ||
      code == 'payment_proof_approved' ||
      code == 'payment_proof_rejected' ||
      entityType == 'deposit') {
    final id = idOf('deposit', 'depositId');
    return id != null ? '/account/deposits/$id' : '/account/deposits';
  }
  // Installment notices (overdue, due soon, schedule ready) are filed under
  // their contract but belong on the installments screen.
  if (code.startsWith('installment_') ||
      code.startsWith('payment_proof_') ||
      code == 'booking_payment_proof_submitted') {
    return '/account/installments';
  }
  if (code.startsWith('contract_') ||
      code == 'broker_contract_signed' ||
      code == 'broker_contract_created' ||
      entityType == 'contract') {
    final id = idOf('contract', 'contractId');
    return id != null ? '/account/contracts/$id' : '/account/contracts';
  }
  if (code.startsWith('visit_') ||
      code.startsWith('info_request_') ||
      entityType == 'visit' ||
      entityType == 'visit_request' ||
      entityType == 'info_request') {
    return '/account/requests';
  }
  if (code.startsWith('reservation_') || entityType == 'reservation') {
    return '/account/finance';
  }
  return null;
}
