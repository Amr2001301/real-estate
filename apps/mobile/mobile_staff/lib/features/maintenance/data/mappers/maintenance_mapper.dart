import 'package:core/core_domain.dart';

import '../../domain/entities/maintenance_request.dart';
import '../dtos/maintenance_dtos.dart';

DateTime? _date(String? iso) => (iso == null || iso.isEmpty) ? null : DateTime.tryParse(iso);

extension MaintenanceRequestDtoMapper on MaintenanceRequestDto {
  MaintenanceRequest toEntity() => MaintenanceRequest(
        id: id,
        description: description,
        status: MaintenanceStatus.fromWire(status),
        priority: MaintenancePriority.fromWire(priority),
        reviewStatus: reviewStatus,
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        unitCode: unitCode,
        unitLat: unitLat,
        unitLng: unitLng,
        unitAddress: unitAddress,
        categoryName: (categoryNameAr != null || categoryNameEn != null)
            ? Translatable(ar: categoryNameAr ?? '', en: categoryNameEn ?? '')
            : null,
        warrantyStatus: MaintenanceWarrantyStatus.fromWire(warrantyStatus),
        warrantyEndSnapshot: _date(warrantyEndSnapshot),
        itemName: (itemNameAr != null || itemNameEn != null)
            ? Translatable(ar: itemNameAr ?? '', en: itemNameEn ?? '')
            : null,
        createdAt: _date(createdAt),
        approvedAt: _date(approvedAt),
        assignedAt: _date(assignedAt),
        dueAt: _date(dueAt),
        resolvedAt: _date(resolvedAt),
        closedAt: _date(closedAt),
        complaintAt: _date(complaintAt),
        unresolvedAt: _date(unresolvedAt),
        customerConfirmedResolutionAt: _date(customerConfirmedResolutionAt),
        supervisorConfirmedResolutionAt: _date(supervisorConfirmedResolutionAt),
        resolvedBy: MaintenanceResolvedBy.fromWire(resolvedBy),
        customerRating: customerRating,
        customerRatingText: customerRatingText,
        customerRatingSubmittedAt: _date(customerRatingSubmittedAt),
      );
}

extension MaintenanceDetailDtoMapper on MaintenanceDetailDto {
  MaintenanceDetail toEntity() => MaintenanceDetail(
        request: request.toEntity(),
        documents: [
          for (final d in documents)
            MaintenanceDoc(
              id: d.id,
              title: d.title,
              fileName: d.fileName,
              url: d.url,
              mimeType: d.mimeType,
            ),
        ],
      );
}
