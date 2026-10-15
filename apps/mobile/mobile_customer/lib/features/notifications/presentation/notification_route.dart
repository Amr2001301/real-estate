/// The one mapping from a notification to a customer-app screen, shared by
/// the notification list and push taps so the same notice always opens the
/// same place.
///
/// [code] is the templateCode; [data] is the notification payload (in-app) or
/// the push data map. Only list screens are returned: the detail screens are
/// opened from their list with the loaded object, not from an id alone.
/// Returns null when no screen applies.
String? customerNotificationRoute(String code, Map<String, dynamic> data) {
  final entityType = data['entityType'] is String ? data['entityType'] as String : null;

  if (code.startsWith('maintenance_') || entityType == 'maintenance') {
    return '/account/maintenance';
  }
  if (code.startsWith('deposit_') ||
      code.startsWith('cheque_') ||
      code == 'payment_proof_approved' ||
      code == 'payment_proof_rejected' ||
      entityType == 'deposit') {
    return '/account/deposits';
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
    return '/account/contracts';
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
