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
        availableUnitsCount: availableUnitsCount,
        totalUnitsCount: totalUnitsCount,
        soldUnitsCount: soldUnitsCount,
        startingPrice: startingPrice,
        unitTypes: unitTypes,
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
        projectId: projectId,
        projectName: (projectNameAr != null || projectNameEn != null)
            ? Translatable(ar: projectNameAr ?? '', en: projectNameEn ?? '')
            : null,
        projectCity: projectCity,
        projectCoverImageUrl: projectCoverImageUrl,
      );
}
