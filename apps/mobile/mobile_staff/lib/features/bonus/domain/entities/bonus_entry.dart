import 'package:core/core_domain.dart';

/// A bonus/commission entry for the sales rep. `status` is the wire value
/// (PENDING/APPROVED/PAID); `amount` stays a raw string (format at the edge).
class BonusEntry extends Equatable {
  const BonusEntry({
    required this.id,
    required this.amount,
    required this.period,
    required this.status,
    this.ruleName,
    this.commissionPct,
    this.paidAt,
    this.createdAt,
  });

  final String id;
  final String amount;
  final String period;
  final String status;
  final String? ruleName;
  final String? commissionPct;
  final DateTime? paidAt;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, amount, period, status, paidAt];
}

/// Aggregated bonus totals across the rep's entries (computed client-side).
class BonusOverview extends Equatable {
  const BonusOverview({
    required this.paidTotal,
    required this.pendingTotal,
    required this.count,
  });

  /// Sum of PAID amounts.
  final double paidTotal;

  /// Sum of not-yet-paid amounts (PENDING + APPROVED).
  final double pendingTotal;
  final int count;

  @override
  List<Object?> get props => [paidTotal, pendingTotal, count];
}
