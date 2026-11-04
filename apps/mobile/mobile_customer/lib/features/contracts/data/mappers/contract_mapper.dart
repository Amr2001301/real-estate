import 'package:core/core_domain.dart';

import '../../domain/entities/contract.dart';
import '../dtos/contract_dto.dart';

extension ContractDtoMapper on ContractDto {
  Contract toEntity() => Contract(
        id: id,
        contractNumber: contractNumber,
        unitCode: unitCode,
        unitType: unitType,
        projectName: Translatable(ar: projectNameAr ?? '', en: projectNameEn ?? ''),
        status: signed ? ContractStatus.signed : ContractStatus.draft,
        signedAt: DateTime.tryParse(signedAt ?? ''),
        createdAt: DateTime.tryParse(createdAt ?? ''),
        handedOverAt: DateTime.tryParse(handedOverAt ?? ''),
        deliveryDate: DateTime.tryParse(deliveryDate ?? ''),
        expectedDeliveryDate: DateTime.tryParse(expectedDeliveryDate ?? ''),
        deliveryDelayDays: deliveryDelayDays,
        totalAmount: totalAmount,
        downPayment: downPayment,
        plan: planMonths != null && planAmount != null
            ? ContractPlan(
                totalMonths: planMonths!,
                monthlyAmount: planAmount!,
                startsAt: DateTime.tryParse(planStartsAt ?? ''),
                frequency: planFrequency ?? 'MONTHLY',
              )
            : null,
      );
}
