import 'package:core/core_domain.dart';

import 'media_item.dart';

/// A project as shown in listings/cards. Domain entity (pure Dart) — represents
/// business meaning, not the API payload shape.
class ProjectListItem extends Equatable {
  const ProjectListItem({
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
  final String? coverImage;
  final int availableUnitsCount;

  @override
  List<Object?> get props => [id, name, city, featured, coverImage];
}

/// Full project detail (adds media gallery).
class ProjectDetail extends Equatable {
  const ProjectDetail({
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
  final List<MediaItem> media;
  final int availableUnitsCount;

  String? get coverImage => media.isNotEmpty ? media.first.url : null;
  List<String> get galleryImages => imageUrls(media);
  bool get hasLocation => lat != null && lng != null;

  @override
  List<Object?> get props => [id, name, city, media, availableUnitsCount];
}
