import '../../domain/entities/deposit.dart';
import '../dtos/deposit_dto.dart';

extension DepositDtoMapper on DepositDto {
  Deposit toEntity() => Deposit(
        id: id,
        amount: amount,
        type: DepositType.fromWire(type),
        verified: verified,
        paidAt: DateTime.tryParse(paidAt ?? ''),
        contractNumber: contractNumber,
        unitCode: unitCode,
      );
}
