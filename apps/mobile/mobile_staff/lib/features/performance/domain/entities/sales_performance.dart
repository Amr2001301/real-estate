import 'package:core/core_domain.dart';

/// Per-rep performance for one period (from /sales-targets/performance). All
/// counts + target/achievement figures the dashboard, targets, and profile use.
class SalesPerformance extends Equatable {
  const SalesPerformance({
    required this.period,
    required this.leadsCount,
    required this.openLeadsCount,
    required this.visitsCount,
    required this.upcomingVisitsCount,
    required this.reservationsCount,
    required this.activeReservationsCount,
    required this.convertedReservationsCount,
    required this.signedContractsCount,
    required this.realizedValue,
    this.targetAmount,
    this.targetUnits,
    required this.achievedAmount,
    required this.achievedUnits,
    this.targetAmountPercent,
    this.targetUnitsPercent,
  });

  final String period;
  final int leadsCount;
  final int openLeadsCount;
  final int visitsCount;
  final int upcomingVisitsCount;
  final int reservationsCount;
  final int activeReservationsCount;
  final int convertedReservationsCount;
  final int signedContractsCount;
  final double realizedValue;
  final double? targetAmount;
  final int? targetUnits;
  final double achievedAmount;
  final int achievedUnits;

  /// 0..100 (may exceed 100); null when no target is set.
  final double? targetAmountPercent;
  final double? targetUnitsPercent;

  bool get hasTarget => targetAmount != null || targetUnits != null;

  @override
  List<Object?> get props => [
        period,
        leadsCount,
        visitsCount,
        reservationsCount,
        targetAmount,
        achievedAmount,
        targetAmountPercent,
        targetUnitsPercent,
      ];
}

/// A target definition for one period (from /sales-targets) — used for history.
class SalesTarget extends Equatable {
  const SalesTarget({
    required this.id,
    required this.period,
    required this.amountTarget,
    required this.unitsTarget,
  });

  final String id;
  final String period;
  final String amountTarget;
  final int unitsTarget;

  @override
  List<Object?> get props => [id, period, amountTarget, unitsTarget];
}
