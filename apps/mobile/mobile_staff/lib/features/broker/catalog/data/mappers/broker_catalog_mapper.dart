import 'package:core/core_domain.dart';

import '../../domain/entities/broker_project.dart';
import '../dtos/broker_catalog_dtos.dart';

extension BrokerProjectDtoMapper on BrokerProjectDto {
  BrokerProject toEntity() => BrokerProject(
        id: id,
        name: Translatable(ar: nameAr ?? '', en: nameEn ?? ''),
        status: status,
        city: city,
        coverImageUrl: coverImageUrl,
        commissionPct: commissionPct,
        description: (descriptionAr != null || descriptionEn != null)
            ? Translatable(ar: descriptionAr ?? '', en: descriptionEn ?? '')
            : null,
        lat: lat,
        lng: lng,
        services: services
            ?.map((s) {
              final ar = s['ar'] as String?;
              final en = s['en'] as String?;
              if (ar == null && en == null) return null;
              return Translatable(ar: ar ?? '', en: en ?? '');
            })
            .whereType<Translatable>()
            .toList(),
      );
}

extension BrokerUnitDtoMapper on BrokerUnitDto {
  BrokerUnit toEntity() => BrokerUnit(
        id: id,
        code: code,
        status: status,
        type: type,
        price: price,
        area: area,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        floor: floor,
        coverImageUrl: coverImageUrl,
        allImageUrls: allImageUrls,
        floorPlanUrls: floorPlanUrls,
        address: address,
        latitude: latitude,
        longitude: longitude,
        projectId: projectId,
        projectNameAr: projectNameAr,
        projectNameEn: projectNameEn,
        projectCity: projectCity,
      );
}
