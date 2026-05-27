import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/unit.dart';
import '../dtos/unit_dto.dart';
import 'project_mapper.dart';

/// Maps unit DTOs → domain entities (including the wire-status → enum mapping).
extension UnitProjectRefDtoMapper on UnitProjectRefDto {
  UnitProjectRef toEntity() => UnitProjectRef(id: id, name: name, city: city);
}

extension UnitDtoMapper on UnitDto {
  Unit toEntity() => Unit(
        id: id,
        code: code,
        type: type,
        area: area,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        floor: floor,
        price: price,
        status: UnitStatus.fromWire(statusWire),
        coverImage: coverImage,
        media: media.map((m) => m.toEntity()).toList(),
        project: project?.toEntity(),
      );
}
