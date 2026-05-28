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
      );
}
