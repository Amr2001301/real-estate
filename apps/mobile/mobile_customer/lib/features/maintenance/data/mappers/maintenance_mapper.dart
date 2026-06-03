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

DateTime? _parseDate(String? iso) =>
    (iso == null || iso.isEmpty) ? null : DateTime.tryParse(iso);

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
        createdAt: _parseDate(createdAt),
        dueAt: _parseDate(dueAt),
        complaintAt: _parseDate(complaintAt),
        unresolvedAt: _parseDate(unresolvedAt),
        customerConfirmedResolutionAt: _parseDate(customerConfirmedResolutionAt),
        supervisorConfirmedResolutionAt: _parseDate(supervisorConfirmedResolutionAt),
        resolvedBy: MaintenanceResolvedBy.fromWire(resolvedBy),
        customerRating: customerRating,
        customerRatingText: customerRatingText,
        customerRatingSubmittedAt: _parseDate(customerRatingSubmittedAt),
      );
}
