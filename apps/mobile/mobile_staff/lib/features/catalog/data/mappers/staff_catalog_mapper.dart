import 'package:core/core_domain.dart';

import '../../domain/entities/staff_project.dart';
import '../dtos/staff_catalog_dtos.dart';

extension StaffProjectDtoMapper on StaffProjectDto {
  StaffProject toEntity() => StaffProject(
        id: id,
        name: Translatable(ar: nameAr ?? '', en: nameEn ?? ''),
        status: status,
        description: (descriptionAr != null || descriptionEn != null)
            ? Translatable(ar: descriptionAr ?? '', en: descriptionEn ?? '')
            : null,
        city: city,
        coverImageUrl: coverImageUrl,
        mediaUrls: mediaUrls,
        floorPlanUrls: floorPlanUrls,
        availableUnitsCount: availableUnitsCount,
        totalUnitsCount: totalUnitsCount,
        soldUnitsCount: soldUnitsCount,
        startingPrice: startingPrice,
        unitTypes: unitTypes,
        lat: lat,
        lng: lng,
        services: services,
      );
}

extension StaffUnitDtoMapper on StaffUnitDto {
  StaffUnit toEntity() => StaffUnit(
        id: id,
        code: code,
        status: status,
        type: type,
        price: price,
        area: area,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        floor: floor,
        coverImage: coverImage,
        mediaUrls: mediaUrls,
        floorPlanUrls: floorPlanUrls,
        maintenanceItems:
            maintenanceItems.map((d) => d.toEntity()).toList(),
        projectId: projectId,
        projectName: (projectNameAr != null || projectNameEn != null)
            ? Translatable(ar: projectNameAr ?? '', en: projectNameEn ?? '')
            : null,
        projectCity: projectCity,
        projectCoverImageUrl: projectCoverImageUrl,
        latitude: latitude,
        longitude: longitude,
        address: address,
      );
}

extension StaffMaintenanceItemDtoMapper on StaffMaintenanceItemDto {
  StaffMaintenanceItem toEntity() => StaffMaintenanceItem(
        id: id,
        name: Translatable(ar: nameAr ?? '', en: nameEn ?? ''),
        categoryName: (categoryNameAr != null || categoryNameEn != null)
            ? Translatable(ar: categoryNameAr ?? '', en: categoryNameEn ?? '')
            : null,
        warrantyStart: warrantyStart != null
            ? DateTime.tryParse(warrantyStart!)
            : null,
        warrantyEnd: warrantyEnd != null
            ? DateTime.tryParse(warrantyEnd!)
            : null,
        warrantyDurationMonths: warrantyDurationMonthsSnapshot,
        supplierName: supplierName,
        contractorName: contractorName,
        notes: notes,
      );
}
