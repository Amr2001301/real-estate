import '../../domain/entities/installment.dart';
import '../dtos/installment_dto.dart';

extension InstallmentDtoMapper on InstallmentDto {
  Installment toEntity() => Installment(
        id: id,
        amount: amount,
        dueDate: DateTime.tryParse(dueDate) ?? DateTime.now(),
        status: InstallmentStatus.fromWire(status),
        type: InstallmentPaymentType.fromWire(type),
        paidAt: DateTime.tryParse(paidAt ?? ''),
        contractId: contractId,
        contractNumber: contractNumber,
        unitCode: unitCode,
        unitType: unitType,
        projectNameAr: projectNameAr,
        projectNameEn: projectNameEn,
        latestProof: latestProof?.toEntity(),
      );
}

extension DepositProofSummaryDtoMapper on DepositProofSummaryDto {
  PaymentProofSummary toEntity() => PaymentProofSummary(
        depositId: id,
        reviewStatus: PaymentProofStatus.fromWire(reviewStatus),
        paymentMethod:
            paymentMethod == null ? null : PaymentMethod.fromWire(paymentMethod),
        rejectionReason: rejectionReason,
        submittedAt: DateTime.tryParse(submittedAt ?? ''),
      );
}
