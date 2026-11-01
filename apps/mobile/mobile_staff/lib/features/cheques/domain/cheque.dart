import 'package:core/core_domain.dart';

/// FG-01 — a customer's cheque (or bank transfer) as the treasurer follows it
/// (GET /payment-instruments). Read-only in the app: depositing, clearing
/// and bouncing stay on the dashboard for now.
class Cheque extends Equatable {
  const Cheque({
    required this.id,
    required this.type,
    required this.status,
    this.number,
    this.bank,
    this.dueDate,
    this.clearingDate,
    this.bounceDate,
    this.bounceReason,
    this.amount,
    this.customer,
    this.contractId,
    this.contractNumber,
    this.reservationId,
    this.reservationNumber,
    this.recordedBy,
    this.createdAt,
    this.payments = const [],
    this.replacedByNumber,
  });

  final String id;

  /// CHEQUE · BANK_TRANSFER
  final String type;

  /// PENDING_CLEARANCE · DEPOSITED · CLEARED · BOUNCED · REPLACED · CANCELLED
  final String status;
  final String? number;
  final String? bank;
  final DateTime? dueDate;
  final DateTime? clearingDate;
  final DateTime? bounceDate;
  final String? bounceReason;

  /// What the payments it covers add up to.
  final num? amount;
  final String? customer;
  final String? contractId;
  final String? contractNumber;
  final String? reservationId;
  final String? reservationNumber;
  final String? recordedBy;
  final DateTime? createdAt;
  final List<ChequePayment> payments;
  final String? replacedByNumber;

  bool get isCheque => type == 'CHEQUE';

  /// Waiting with the company past its due date: time to take it to the bank.
  bool dueForDeposit(DateTime now) =>
      status == 'PENDING_CLEARANCE' && dueDate != null && !dueDate!.isAfter(now);

  /// The detail read (GET /payment-instruments/:id) has the payments' rows
  /// but not the customer or contract; keep those from the list row.
  Cheque withListContext(Cheque row) => Cheque(
        id: id,
        type: type,
        status: status,
        number: number,
        bank: bank,
        dueDate: dueDate,
        clearingDate: clearingDate,
        bounceDate: bounceDate,
        bounceReason: bounceReason,
        amount: amount ?? row.amount,
        customer: customer ?? row.customer,
        contractId: contractId ?? row.contractId,
        contractNumber: contractNumber ?? row.contractNumber,
        reservationId: reservationId ?? row.reservationId,
        reservationNumber: reservationNumber ?? row.reservationNumber,
        recordedBy: recordedBy,
        createdAt: createdAt,
        payments: payments,
        replacedByNumber: replacedByNumber,
      );

  factory Cheque.fromJson(Map<String, dynamic> json) {
    DateTime? date(String key) => DateTime.tryParse(json[key] as String? ?? '')?.toLocal();
    final deposits = ((json['deposits'] as List?) ?? const []).whereType<Map<String, dynamic>>().toList();
    num? total;
    for (final d in deposits) {
      final a = num.tryParse('${d['amount'] ?? ''}');
      if (a != null) total = (total ?? 0) + a;
    }
    // The customer and the contract / reservation come with the list's rows.
    Map<String, dynamic>? contract;
    Map<String, dynamic>? reservation;
    for (final d in deposits) {
      contract ??= d['contract'] as Map<String, dynamic>?;
      reservation ??= d['reservation'] as Map<String, dynamic>?;
    }
    final customer = (contract?['customer'] as Map<String, dynamic>?)?['fullName'] as String? ??
        (reservation?['client'] as Map<String, dynamic>?)?['fullName'] as String?;
    final replacedBy = json['replacedBy'] as Map<String, dynamic>?;
    return Cheque(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? 'CHEQUE',
      status: json['status'] as String? ?? 'PENDING_CLEARANCE',
      number: (json['chequeNumber'] as String?) ?? (json['referenceNumber'] as String?),
      bank: (json['drawerBankName'] as String?) ?? (json['bankName'] as String?),
      dueDate: date('chequeDueDate'),
      clearingDate: date('clearingDate'),
      bounceDate: date('bounceDate'),
      bounceReason: json['bounceReason'] as String?,
      amount: total,
      customer: customer,
      contractId: contract?['id'] as String?,
      contractNumber: contract?['contractNumber'] as String?,
      reservationId: reservation?['id'] as String?,
      reservationNumber: reservation?['reservationNumber'] as String?,
      recordedBy: (json['recordedBy'] as Map<String, dynamic>?)?['fullName'] as String?,
      createdAt: date('createdAt'),
      payments: [for (final d in deposits) ChequePayment.fromJson(d)],
      replacedByNumber: replacedBy?['chequeNumber'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, status, number, bank, dueDate, amount, customer, contractNumber, payments];
}

/// One payment a cheque covers, with the installment it pays.
class ChequePayment extends Equatable {
  const ChequePayment({this.amount, this.reviewStatus, this.installmentDue, this.installmentStatus});
  final num? amount;
  final String? reviewStatus;
  final DateTime? installmentDue;
  final String? installmentStatus;

  factory ChequePayment.fromJson(Map<String, dynamic> json) {
    final inst = json['installment'] as Map<String, dynamic>?;
    return ChequePayment(
      amount: num.tryParse('${json['amount'] ?? ''}'),
      reviewStatus: json['reviewStatus'] as String?,
      installmentDue: DateTime.tryParse(inst?['dueDate'] as String? ?? '')?.toLocal(),
      installmentStatus: inst?['status'] as String?,
    );
  }

  @override
  List<Object?> get props => [amount, reviewStatus, installmentDue, installmentStatus];
}

/// The list's status tabs, in the treasurer's order.
const kChequeStatuses = ['PENDING_CLEARANCE', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'REPLACED', 'CANCELLED'];

abstract interface class ChequesRepository {
  /// Cheques only, soonest due first; [status] null = all.
  Future<Result<Paginated<Cheque>>> list({String? status, String? q, int page = 1});
  Future<Result<Cheque>> get(String id);
}
