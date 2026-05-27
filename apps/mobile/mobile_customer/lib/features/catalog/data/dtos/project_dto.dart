import 'package:core/core_domain.dart';

import 'dto_support.dart';
import 'media_dto.dart';

/// Wire shape of `GET /public/projects` list items. Data layer only.
class ProjectListItemDto {
  const ProjectListItemDto({
    required this.id,
    required this.name,
    required this.description,
    required this.city,
    required this.services,
    required this.featured,
    required this.availableUnitsCount,
    this.lat,
    this.lng,
    this.coverImage,
  });

  final String id;
  final Translatable name;
  final Translatable description;
  final String city;
  final double? lat;
  final double? lng;
  final List<Translatable> services;
  final bool featured;
  final int availableUnitsCount;
  final String? coverImage;

  factory ProjectListItemDto.fromJson(Map<String, dynamic> json) {
    return ProjectListItemDto(
      id: json['id'] as String,
      name: translatableFromJson(json['name']),
      description: translatableFromJson(json['description']),
      city: json['city'] as String? ?? '',
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      services: (json['services'] as List? ?? [])
          .map(translatableFromJson)
          .toList(),
      featured: json['featured'] as bool? ?? false,
      availableUnitsCount: (json['availableUnitsCount'] as num?)?.toInt() ?? 0,
      coverImage: json['coverImage'] as String?,
    );
  }
}

/// Wire shape of `GET /public/projects/:id`.
class ProjectDetailDto {
  const ProjectDetailDto({
    required this.id,
    required this.name,
    required this.description,
    required this.city,
    required this.services,
    required this.featured,
    required this.media,
    required this.availableUnitsCount,
    this.lat,
    this.lng,
  });

  final String id;
  final Translatable name;
  final Translatable description;
  final String city;
  final double? lat;
  final double? lng;
  final List<Translatable> services;
  final bool featured;
  final List<MediaDto> media;
  final int availableUnitsCount;

  factory ProjectDetailDto.fromJson(Map<String, dynamic> json) {
    return ProjectDetailDto(
      id: json['id'] as String,
      name: translatableFromJson(json['name']),
      description: translatableFromJson(json['description']),
      city: json['city'] as String? ?? '',
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      services: (json['services'] as List? ?? [])
          .map(translatableFromJson)
          .toList(),
      featured: json['featured'] as bool? ?? false,
      media: (json['media'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(MediaDto.fromJson)
          .toList(),
      availableUnitsCount: (json['availableUnitsCount'] as num?)?.toInt() ?? 0,
    );
  }
}
