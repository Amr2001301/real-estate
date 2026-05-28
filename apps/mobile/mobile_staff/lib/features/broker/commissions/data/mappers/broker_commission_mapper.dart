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
      );
}
