import 'package:core/core_domain.dart';

import '../../domain/entities/maintenance_category.dart';
import '../../domain/entities/maintenance_request.dart';
import '../dtos/maintenance_dtos.dart';

extension MaintenanceCategoryDtoMapper on MaintenanceCategoryDto {
  MaintenanceCategory toEntity() => MaintenanceCategory(
        id: id,
        name: Translatable(ar: nameAr ?? '', en: nameEn ?? ''),
      );
}

extension MaintenanceRequestDtoMapper on MaintenanceRequestDto {
  MaintenanceRequest toEntity() => MaintenanceRequest(
        id: id,
        description: description,
        status: MaintenanceStatus.fromWire(status),
        priority: MaintenancePriority.fromWire(priority),
        unitCode: unitCode,
        categoryName: (categoryNameAr != null || categoryNameEn != null)
            ? Translatable(ar: categoryNameAr ?? '', en: categoryNameEn ?? '')
            : null,
        createdAt: DateTime.tryParse(createdAt ?? ''),
      );
}
