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
        state: state,
        paymentMethod: paymentMethod,
        reviewStatus: reviewStatus,
        rejectionReason: rejectionReason,
        reviewedAt: DateTime.tryParse(reviewedAt ?? ''),
        createdAt: DateTime.tryParse(createdAt ?? ''),
        installmentDueDate: DateTime.tryParse(installmentDueDate ?? ''),
        reservationNumber: reservationNumber,
        hasProof: hasProof,
      );
}
