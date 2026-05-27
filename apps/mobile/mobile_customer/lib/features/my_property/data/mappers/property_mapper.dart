import 'package:core/core_domain.dart';

import '../../domain/entities/property.dart';
import '../dtos/property_row_dto.dart';

extension PropertyRowDtoMapper on PropertyRowDto {
  Property toEntity() => Property(
        contractId: contractId,
        contractNumber: contractNumber,
        unitId: unitId,
        unitCode: unitCode,
        unitType: unitType,
        projectId: projectId,
        projectName: Translatable(
          ar: projectNameAr ?? '',
          en: projectNameEn ?? '',
        ),
        status: signed ? PropertyStatus.owned : PropertyStatus.pending,
        signedAt: DateTime.tryParse(signedAt ?? ''),
        reservationNumber: reservationNumber,
        monthlyAmount: monthlyAmount,
        totalMonths: totalMonths,
      );
}
