import '../../domain/entities/sales_performance.dart';
import '../dtos/performance_dtos.dart';

extension SalesPerformanceDtoMapper on SalesPerformanceDto {
  SalesPerformance toEntity() => SalesPerformance(
        period: period,
        leadsCount: leadsCount,
        openLeadsCount: openLeadsCount,
        visitsCount: visitsCount,
        upcomingVisitsCount: upcomingVisitsCount,
        reservationsCount: reservationsCount,
        activeReservationsCount: activeReservationsCount,
        convertedReservationsCount: convertedReservationsCount,
        signedContractsCount: signedContractsCount,
        realizedValue: realizedValue,
        achievedAmount: achievedAmount,
        achievedUnits: achievedUnits,
        targetAmount: targetAmount,
        targetUnits: targetUnits,
        targetAmountPercent: targetAmountPercent,
        targetUnitsPercent: targetUnitsPercent,
      );
}

extension SalesTargetDtoMapper on SalesTargetDto {
  SalesTarget toEntity() => SalesTarget(
        id: id,
        period: period,
        amountTarget: amountTarget,
        unitsTarget: unitsTarget,
      );
}
