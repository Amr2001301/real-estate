import '../../domain/entities/staff_deposit.dart';
import '../dtos/staff_deposit_dto.dart';

extension StaffDepositDtoMapper on StaffDepositDto {
  StaffDeposit toEntity() => StaffDeposit(
        id: id,
        amount: amount,
        type: type,
        verified: verified ?? false,
        reviewStatus: _parseReviewStatus(reviewStatus),
        paidAt: paidAt != null ? DateTime.tryParse(paidAt!) : null,
        contractNumber: contractNumber,
        customerName: customerName,
        unitCode: unitCode,
        installmentDueDate:
            installmentDueDate != null ? DateTime.tryParse(installmentDueDate!) : null,
      );
}

DepositReviewStatus? _parseReviewStatus(String? raw) => switch (raw) {
      'PENDING_REVIEW' => DepositReviewStatus.pending,
      'APPROVED' => DepositReviewStatus.approved,
      'REJECTED' => DepositReviewStatus.rejected,
      _ => null,
    };
