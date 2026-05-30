// Subset of a /me/installments row + the embedded customer-visible Deposit
// (P11.5). Data layer only — domain layer never sees this shape.
//
// The backend returns the installment row with a nested `plan.contract`
// chain (contract → unit → building → phase → project) and a `deposits`
// array. We pluck only the fields the mobile UI renders. Per the P11
// security audit, NO file URLs are exposed in /me/installments — only
// metadata. Receipts are reached via the existing signed-download path.
class InstallmentDto {
  const InstallmentDto({
    required this.id,
    required this.amount,
    required this.dueDate,
    required this.status,
    required this.type,
    this.paidAt,
    this.contractId,
    this.contractNumber,
    this.unitCode,
    this.unitType,
    this.projectNameAr,
    this.projectNameEn,
    this.latestProof,
  });

  final String id;
  final String amount;
  final String dueDate;
  final String status; // PENDING | PAID | OVERDUE
  final String type;   // PlanPaymentType
  final String? paidAt;
  final String? contractId;
  final String? contractNumber;
  final String? unitCode;
  final String? unitType;
  final String? projectNameAr;
  final String? projectNameEn;
  final DepositProofSummaryDto? latestProof;

  factory InstallmentDto.fromJson(Map<String, dynamic> json) {
    final plan = json['plan'] as Map<String, dynamic>?;
    final contract = plan?['contract'] as Map<String, dynamic>?;
    final unit = contract?['unit'] as Map<String, dynamic>?;
    final project =
        ((unit?['building'] as Map<String, dynamic>?)?['phase']
                as Map<String, dynamic>?)?['project'] as Map<String, dynamic>?;
    final projectName = project?['name'] as Map<String, dynamic>?;

    // The backend embeds latest deposit (if any) when the customer surface
    // is enriched. Today /me/installments is lean — we look up proof state
    // separately via /me/deposits when needed — but the DTO accepts a
    // shape-tolerant optional latestProof so a future enrichment requires
    // zero mobile changes.
    final deposit = json['latestProof'] as Map<String, dynamic>?;

    return InstallmentDto(
      id: json['id'] as String,
      amount: json['amount']?.toString() ?? '',
      dueDate: json['dueDate'] as String? ?? '',
      status: json['status'] as String? ?? '',
      type: json['type'] as String? ?? '',
      paidAt: json['paidAt'] as String?,
      contractId: contract?['id'] as String?,
      contractNumber: contract?['contractNumber'] as String?,
      unitCode: unit?['code'] as String?,
      unitType: unit?['type'] as String?,
      projectNameAr: projectName?['ar'] as String?,
      projectNameEn: projectName?['en'] as String?,
      latestProof:
          deposit == null ? null : DepositProofSummaryDto.fromJson(deposit),
    );
  }
}

/// Customer-visible review state on a single Deposit that backs an
/// installment payment. Source of truth for the "Pending review / Approved
/// / Rejected" badge in the UI.
class DepositProofSummaryDto {
  const DepositProofSummaryDto({
    required this.id,
    required this.reviewStatus,
    this.paymentMethod,
    this.rejectionReason,
    this.submittedAt,
  });

  final String id;
  final String reviewStatus; // NO_PROOF|PENDING_REVIEW|APPROVED|REJECTED
  final String? paymentMethod; // CASH|BANK_TRANSFER|CHEQUE|OTHER
  final String? rejectionReason;
  final String? submittedAt;

  factory DepositProofSummaryDto.fromJson(Map<String, dynamic> json) =>
      DepositProofSummaryDto(
        id: json['id'] as String,
        reviewStatus: json['reviewStatus'] as String? ?? 'NO_PROOF',
        paymentMethod: json['paymentMethod'] as String?,
        rejectionReason: json['rejectionReason'] as String?,
        submittedAt: json['createdAt'] as String? ?? json['paidAt'] as String?,
      );
}
