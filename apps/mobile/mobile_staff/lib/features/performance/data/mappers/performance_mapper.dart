import '../../domain/entities/sales_performance.dart';
import '../dtos/performance_dtos.dart';

extension TeamPerformanceRowDtoMapper on TeamPerformanceRowDto {
  TeamMemberPerformance toEntity() => TeamMemberPerformance(
        salesId: salesId,
        salesName: salesName,
        performance: perf.toEntity(),
      );
}

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
        salesId: salesId,
        salesName: salesName,
        period: period,
        amountTarget: amountTarget,
        unitsTarget: unitsTarget,
      );
}

extension SalesActorDtoMapper on SalesActorDto {
  SalesActor toEntity() => SalesActor(
        id: id,
        fullName: fullName,
        role: role,
      );
}
