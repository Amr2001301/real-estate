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

/// One team member's performance row (from /sales-targets/performance for manager).
class TeamMemberPerformance extends Equatable {
  const TeamMemberPerformance({
    required this.salesId,
    required this.salesName,
    required this.performance,
  });

  final String salesId;
  final String salesName;
  final SalesPerformance performance;

  @override
  List<Object?> get props => [salesId, salesName, performance];
}

/// A target definition for one period (from /sales-targets).
class SalesTarget extends Equatable {
  const SalesTarget({
    required this.id,
    required this.salesId,
    required this.salesName,
    required this.period,
    required this.amountTarget,
    required this.unitsTarget,
  });

  final String id;
  final String salesId;
  final String salesName;
  final String period;
  final String amountTarget;
  final int unitsTarget;

  @override
  List<Object?> get props => [id, salesId, period, amountTarget, unitsTarget];
}

/// A user who can have sales targets set (from /sales-targets/actors).
class SalesActor extends Equatable {
  const SalesActor({
    required this.id,
    required this.fullName,
    required this.role,
  });

  final String id;
  final String fullName;
  final String role;

  String get initials => fullName.trim().isNotEmpty
      ? fullName.trim().split(' ').map((w) => w[0]).take(2).join()
      : '?';

  @override
  List<Object?> get props => [id, fullName, role];
}
