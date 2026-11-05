import 'package:core/core_domain.dart';

/// A broker commission entry (read-only). `status` is BrokerCommissionStatus.
class BrokerCommission extends Equatable {
  const BrokerCommission({
    required this.id,
    required this.status,
    this.grossAmount,
    this.netAmount,
    this.projectName,
    this.createdAt,
    this.number,
    this.contractId,
    this.contractNumber,
    this.clientName,
    this.basisAmount,
    this.commissionPct,
    this.earnedAt,
    this.payoutId,
  });

  final String id;
  final String status;
  final String? grossAmount;
  final String? netAmount;
  final String? projectName;
  final DateTime? createdAt;
  final String? number;
  final String? contractId;
  final String? contractNumber;
  final String? clientName;

  /// What the rate was taken on, and the rate.
  final String? basisAmount;
  final String? commissionPct;
  final DateTime? earnedAt;

  /// The payout statement it was put on (null until then).
  final String? payoutId;

  @override
  List<Object?> get props => [id, status, grossAmount, netAmount, createdAt];
}
