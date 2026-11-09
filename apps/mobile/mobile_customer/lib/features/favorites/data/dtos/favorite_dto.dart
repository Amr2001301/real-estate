// Wire shape of GET/POST /me/favorites. The list embeds raw project/unit rows;
// we defensively extract only the display fields. Data layer only.
class FavoriteDto {
  const FavoriteDto({
    required this.id,
    required this.isProject,
    required this.targetId,
    required this.titleAr,
    required this.titleEn,
    this.subtitle,
    this.coverImage,
  });

  final String id;
  final bool isProject;
  final String targetId;
  final String titleAr;
  final String titleEn;
  final String? subtitle;
  final String? coverImage;

  factory FavoriteDto.fromJson(Map<String, dynamic> json) {
    final projectId = json['projectId'] as String?;
    final unitId = json['unitId'] as String?;
    final isProject = projectId != null;

    final project = json['project'] as Map<String, dynamic>?;
    final unit = json['unit'] as Map<String, dynamic>?;
    final embedded = isProject ? project : unit;

    // A name arrives as {ar, en} or, when the API flattens it for the
    // language, as a plain string; a unit has no name of its own, so its
    // project's name (when embedded) or its code stands in.
    Object? name;
    String? subtitle;
    if (isProject) {
      name = project?['name'];
      subtitle = project?['city'] as String?;
    } else {
      final unitProject = unit?['project'] as Map<String, dynamic>?;
      name = unitProject?['name'] ?? unit?['code'];
      subtitle = unit?['type'] as String?;
    }
    final (nameAr, nameEn) = _names(name);

    return FavoriteDto(
      id: json['id'] as String,
      isProject: isProject,
      targetId: (isProject ? projectId : unitId) ?? '',
      titleAr: nameAr,
      titleEn: nameEn,
      subtitle: subtitle,
      coverImage: _firstMediaUrl(embedded?['media']),
    );
  }

  static (String, String) _names(Object? name) {
    if (name is Map) {
      return (name['ar'] as String? ?? '', name['en'] as String? ?? '');
    }
    if (name is String) return (name, name);
    return ('', '');
  }

  static String? _firstMediaUrl(Object? media) {
    if (media is List && media.isNotEmpty) {
      final first = media.first;
      if (first is Map && first['url'] is String) return first['url'] as String;
    }
    return null;
  }
}
