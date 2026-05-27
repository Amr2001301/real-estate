import 'package:core/core_domain.dart';

import 'dto_support.dart';
import 'media_dto.dart';

/// Embedded project reference in a unit payload.
class UnitProjectRefDto {
  const UnitProjectRefDto({required this.id, required this.name, required this.city});

  final String id;
  final Translatable name;
  final String city;

  factory UnitProjectRefDto.fromJson(Map<String, dynamic> json) => UnitProjectRefDto(
        id: json['id'] as String? ?? '',
        name: translatableFromJson(json['name']),
        city: json['city'] as String? ?? '',
      );
}

/// Wire shape of `GET /public/units` (list = detail). Data layer only.
/// `statusWire` stays a raw string; the mapper turns it into the domain enum.
class UnitDto {
  const UnitDto({
    required this.id,
    required this.code,
    required this.type,
    required this.area,
    required this.bedrooms,
    required this.bathrooms,
    required this.price,
    required this.statusWire,
    this.floor,
    this.coverImage,
    this.media = const [],
    this.project,
  });

  final String id;
  final String code;
  final String type;
  final num area;
  final int bedrooms;
  final int bathrooms;
  final int? floor;
  final String price;
  final String statusWire;
  final String? coverImage;
  final List<MediaDto> media;
  final UnitProjectRefDto? project;

  factory UnitDto.fromJson(Map<String, dynamic> json) => UnitDto(
        id: json['id'] as String,
        code: json['code'] as String? ?? '',
        type: json['type'] as String? ?? '',
        area: (json['area'] as num?) ?? 0,
        bedrooms: (json['bedrooms'] as num?)?.toInt() ?? 0,
        bathrooms: (json['bathrooms'] as num?)?.toInt() ?? 0,
        floor: (json['floor'] as num?)?.toInt(),
        price: json['price']?.toString() ?? '0',
        statusWire: json['status'] as String? ?? 'UNKNOWN',
        coverImage: json['coverImage'] as String?,
        media: (json['media'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(MediaDto.fromJson)
            .toList(),
        project: json['project'] is Map<String, dynamic>
            ? UnitProjectRefDto.fromJson(json['project'] as Map<String, dynamic>)
            : null,
      );
}
