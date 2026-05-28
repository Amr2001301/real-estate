// Wire shapes for /sales-targets and /sales-targets/performance. Data layer only.

class SalesPerformanceDto {
  const SalesPerformanceDto({
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
    required this.achievedAmount,
    required this.achievedUnits,
    this.targetAmount,
    this.targetUnits,
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
  final double achievedAmount;
  final int achievedUnits;
  final double? targetAmount;
  final int? targetUnits;
  final double? targetAmountPercent;
  final double? targetUnitsPercent;

  static int _i(Object? v) => (v as num?)?.toInt() ?? 0;
  static double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
  static double? _dn(Object? v) => v == null ? null : (v as num).toDouble();
  static int? _in(Object? v) => v == null ? null : (v as num).toInt();

  factory SalesPerformanceDto.fromJson(Map<String, dynamic> json) => SalesPerformanceDto(
        period: json['period'] as String? ?? '',
        leadsCount: _i(json['leadsCount']),
        openLeadsCount: _i(json['openLeadsCount']),
        visitsCount: _i(json['visitsCount']),
        upcomingVisitsCount: _i(json['upcomingVisitsCount']),
        reservationsCount: _i(json['reservationsCount']),
        activeReservationsCount: _i(json['activeReservationsCount']),
        convertedReservationsCount: _i(json['convertedReservationsCount']),
        signedContractsCount: _i(json['signedContractsCount']),
        realizedValue: _d(json['realizedValue']),
        achievedAmount: _d(json['achievedAmount']),
        achievedUnits: _i(json['achievedUnits']),
        targetAmount: _dn(json['targetAmount']),
        targetUnits: _in(json['targetUnits']),
        targetAmountPercent: _dn(json['targetAmountPercent']),
        targetUnitsPercent: _dn(json['targetUnitsPercent']),
      );
}

class SalesTargetDto {
  const SalesTargetDto({
    required this.id,
    required this.period,
    required this.amountTarget,
    required this.unitsTarget,
  });

  final String id;
  final String period;
  final String amountTarget;
  final int unitsTarget;

  factory SalesTargetDto.fromJson(Map<String, dynamic> json) => SalesTargetDto(
        id: json['id'] as String,
        period: json['period'] as String? ?? '',
        amountTarget: json['amountTarget']?.toString() ?? '0',
        unitsTarget: (json['unitsTarget'] as num?)?.toInt() ?? 0,
      );
}
