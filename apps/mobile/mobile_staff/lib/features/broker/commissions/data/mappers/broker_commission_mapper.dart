import '../../domain/entities/broker_commission.dart';
import '../dtos/broker_commission_dto.dart';

extension BrokerCommissionDtoMapper on BrokerCommissionDto {
  BrokerCommission toEntity() => BrokerCommission(
        id: id,
        status: status,
        grossAmount: grossAmount,
        netAmount: netAmount,
        projectName: projectName,
        createdAt: DateTime.tryParse(createdAt ?? ''),
        number: number,
        contractId: contractId,
        contractNumber: contractNumber,
        clientName: clientName,
        basisAmount: basisAmount,
        commissionPct: commissionPct,
        earnedAt: DateTime.tryParse(earnedAt ?? ''),
        payoutId: payoutId,
      );
}
