import 'package:core/core_domain.dart';

/// Whether a contract has been signed (owned) or is still a draft/pending.
enum ContractStatus { signed, draft }

/// A customer's contract on a unit. Domain entity (derived from /me/contracts).
class Contract extends Equatable {
  const Contract({
    required this.id,
    required this.unitCode,
    required this.unitType,
    required this.projectName,
    required this.status,
    this.contractNumber,
    this.signedAt,
    this.createdAt,
    this.handedOverAt,
    this.deliveryDate,
    this.expectedDeliveryDate,
    this.deliveryDelayDays = 0,
    this.totalAmount,
    this.downPayment,
    this.plan,
  });

  final String id;
  final String? contractNumber;
  final String unitCode;
  final String unitType;
  final Translatable projectName;
  final ContractStatus status;
  final DateTime? signedAt;
  final DateTime? createdAt;
  /// When the unit was handed over; maintenance requests open from then.
  final DateTime? handedOverAt;

  /// The handover date the contract promised.
  final DateTime? deliveryDate;
  /// The handover date expected now (the unit's, or its phase's).
  final DateTime? expectedDeliveryDate;
  /// Days the expected date is past the promised one; 0 when on time.
  final int deliveryDelayDays;

  /// The contract's price and down payment, as the website shows them.
  final double? totalAmount;
  final double? downPayment;

  /// The installment plan; null for a cash contract.
  final ContractPlan? plan;

  @override
  List<Object?> get props =>
      [id, contractNumber, unitCode, status, signedAt, handedOverAt, deliveryDate, expectedDeliveryDate, deliveryDelayDays,
        totalAmount, downPayment, plan];
}

/// The installment plan of a contract: how long, how much each time, how often.
class ContractPlan extends Equatable {
  const ContractPlan({required this.totalMonths, required this.monthlyAmount, this.startsAt, this.frequency = 'MONTHLY'});

  final int totalMonths;

  /// The amount of each installment (named monthly on the API whatever the frequency).
  final double monthlyAmount;
  final DateTime? startsAt;

  /// MONTHLY, QUARTERLY, SEMI_ANNUAL or ANNUAL.
  final String frequency;

  @override
  List<Object?> get props => [totalMonths, monthlyAmount, startsAt, frequency];
}
