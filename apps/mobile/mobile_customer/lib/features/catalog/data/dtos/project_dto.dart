import 'package:core/core_domain.dart';

import 'dto_support.dart';
import '../../domain/entities/project_content.dart';
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
    this.sections = const [],
    this.faqs = const [],
    this.amenities = const [],
    this.progress,
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
  final List<ProjectSection> sections;
  final List<ProjectFaq> faqs;
  final List<ProjectAmenity> amenities;
  final ProjectProgress? progress;

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
      sections: _maps(json['sections'])
          .map((m) => ProjectSection(title: translatableFromJson(m['title']), body: translatableFromJson(m['body'])))
          .toList(),
      faqs: _maps(json['faqs'])
          .map((m) => ProjectFaq(question: translatableFromJson(m['question']), answer: translatableFromJson(m['answer'])))
          .toList(),
      amenities: _maps(json['amenities'])
          .map((m) => ProjectAmenity(
                name: translatableFromJson(m['name']),
                icon: m['icon'] as String? ?? 'check',
                group: m['group'] == 'AROUND' ? AmenityGroup.around : AmenityGroup.inside,
              ))
          .toList(),
      progress: _progress(json['progress']),
    );
  }
}

/// The map items of a JSON list (anything else → none). An older API without
/// the keys reads as empty, so the page shows what it showed before.
List<Map<String, dynamic>> _maps(Object? v) => (v as List? ?? const []).whereType<Map<String, dynamic>>().toList();

ProjectProgress? _progress(Object? v) {
  if (v is! Map<String, dynamic>) return null;
  final stages = _maps(v['stages'])
      .map((m) => ProgressStage(
            name: translatableFromJson(m['name']),
            percent: ((m['percent'] as num?)?.toInt() ?? 0).clamp(0, 100),
          ))
      .toList();
  if (stages.isEmpty) return null;
  final at = v['updatedAt'];
  return ProjectProgress(
    overall: ((v['overall'] as num?)?.toInt() ?? 0).clamp(0, 100),
    stages: stages,
    updatedAt: at is String ? DateTime.tryParse(at) : null,
  );
}
