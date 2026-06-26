import 'package:core/core_domain.dart';

import '../../domain/entities/staff_project.dart';
import '../dtos/staff_catalog_dtos.dart';

extension StaffProjectDtoMapper on StaffProjectDto {
  StaffProject toEntity() => StaffProject(
        id: id,
        name: Translatable(ar: nameAr ?? '', en: nameEn ?? ''),
        status: status,
        city: city,
        coverImageUrl: coverImageUrl,
        availableUnitsCount: availableUnitsCount,
        totalUnitsCount: totalUnitsCount,
        soldUnitsCount: soldUnitsCount,
        startingPrice: startingPrice,
        unitTypes: unitTypes,
      );

  Translatable? get descriptionTranslatable =>
      (descriptionAr != null || descriptionEn != null)
          ? Translatable(ar: descriptionAr ?? '', en: descriptionEn ?? '')
          : null;
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
      );
}
