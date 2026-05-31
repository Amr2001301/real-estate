import '../../domain/entities/payment_review_item.dart';
import '../dtos/payment_review_dto.dart';

extension PaymentReviewDtoMapper on PaymentReviewDto {
  PaymentReviewItem toEntity() => PaymentReviewItem(
        id: id,
        amount: amount,
        reviewStatus: PaymentReviewStatus.fromWire(reviewStatus),
        paymentMethod: PaymentMethod.fromWire(paymentMethod),
        paidAt: DateTime.tryParse(paidAt ?? ''),
        submittedAt: DateTime.tryParse(createdAt ?? ''),
        dueDate: DateTime.tryParse(dueDate ?? ''),
        customerName: customerName,
        contractNumber: contractNumber,
        unitCode: unitCode,
        installmentType: installmentType,
        hasProof: hasProof,
        proofFileName: proofFileName,
      );
}
