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

    Map<String, dynamic>? nameMap;
    String? subtitle;
    if (isProject) {
      nameMap = project?['name'] as Map<String, dynamic>?;
      subtitle = project?['city'] as String?;
    } else {
      final unitProject = unit?['project'] as Map<String, dynamic>?;
      nameMap = unitProject?['name'] as Map<String, dynamic>?;
      subtitle = unit?['type'] as String?;
    }

    return FavoriteDto(
      id: json['id'] as String,
      isProject: isProject,
      targetId: (isProject ? projectId : unitId) ?? '',
      titleAr: nameMap?['ar'] as String? ?? '',
      titleEn: nameMap?['en'] as String? ?? '',
      subtitle: subtitle,
      coverImage: _firstMediaUrl(embedded?['media']),
    );
  }

  static String? _firstMediaUrl(Object? media) {
    if (media is List && media.isNotEmpty) {
      final first = media.first;
      if (first is Map && first['url'] is String) return first['url'] as String;
    }
    return null;
  }
}
