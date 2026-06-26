// Wire shapes for the staff `/projects` and `/units` endpoints. Data layer only.

class StaffProjectDto {
  const StaffProjectDto({
    required this.id,
    required this.status,
    this.nameAr,
    this.nameEn,
    this.descriptionAr,
    this.descriptionEn,
    this.city,
    this.coverImageUrl,
    this.mediaUrls = const [],
    this.availableUnitsCount,
    this.totalUnitsCount,
    this.soldUnitsCount,
    this.startingPrice,
    this.unitTypes = const [],
  });

  final String id;
  final String status;
  final String? nameAr;
  final String? nameEn;
  final String? descriptionAr;
  final String? descriptionEn;
  final String? city;
  final String? coverImageUrl;
  /// All media URLs from the project's media array (ordered by `order`).
  final List<String> mediaUrls;
  final int? availableUnitsCount;
  final int? totalUnitsCount;
  final int? soldUnitsCount;
  final double? startingPrice;
  final List<String> unitTypes;

  factory StaffProjectDto.fromJson(Map<String, dynamic> json) {
    final (nameAr, nameEn) = _parseTranslatable(json['name']);
    final (descAr, descEn) = _parseTranslatable(json['description']);
    final media =
        (json['media'] as List?)?.whereType<Map<String, dynamic>>().toList();
    final urls = media
            ?.map((m) => m['url'] as String? ?? '')
            .where((u) => u.isNotEmpty)
            .toList() ??
        const <String>[];
    return StaffProjectDto(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'DRAFT',
      nameAr: nameAr,
      nameEn: nameEn,
      descriptionAr: descAr,
      descriptionEn: descEn,
      city: json['city'] as String?,
      coverImageUrl: json['coverImageUrl'] as String? ??
          (urls.isNotEmpty ? urls.first : null),
      mediaUrls: urls,
      availableUnitsCount: (json['availableUnitsCount'] as num?)?.toInt(),
      totalUnitsCount: (json['totalUnitsCount'] as num?)?.toInt(),
      soldUnitsCount: (json['soldUnitsCount'] as num?)?.toInt(),
      startingPrice: (json['startingPrice'] as num?)?.toDouble(),
      unitTypes: (json['unitTypes'] as List?)?.whereType<String>().toList() ??
          const [],
    );
  }

  static (String?, String?) _parseTranslatable(Object? raw) {
    if (raw is Map<String, dynamic>) {
      return (raw['ar'] as String?, raw['en'] as String?);
    }
    if (raw is String) return (raw, raw);
    return (null, null);
  }
}

class StaffUnitDto {
  const StaffUnitDto({
    required this.id,
    required this.code,
    required this.status,
    this.type,
    this.price,
    this.area,
    this.bedrooms,
    this.bathrooms,
    this.floor,
    this.coverImage,
    this.mediaUrls = const [],
    this.projectId,
    this.projectNameAr,
    this.projectNameEn,
    this.projectCity,
    this.projectCoverImageUrl,
  });

  final String id;
  final String code;
  final String status;
  final String? type;
  final String? price;
  final String? area;
  final int? bedrooms;
  final int? bathrooms;
  final int? floor;
  final String? coverImage;
  final List<String> mediaUrls;
  final String? projectId;
  final String? projectNameAr;
  final String? projectNameEn;
  final String? projectCity;
  final String? projectCoverImageUrl;

  factory StaffUnitDto.fromJson(Map<String, dynamic> json) {
    final media = (json['media'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .toList() ??
        const [];
    final mediaUrls = media
        .map((m) => m['url'] as String? ?? '')
        .where((u) => u.isNotEmpty)
        .toList();

    // Navigate raw Prisma nesting: building → phase → project
    final building = json['building'] as Map<String, dynamic>?;
    final phase = building?['phase'] as Map<String, dynamic>?;
    final project = phase?['project'] as Map<String, dynamic>?;

    final (projNameAr, projNameEn) =
        project != null ? _parseTranslatable(project['name']) : (null, null);

    // Project cover image comes from the first project media entry (added via
    // enhanced findOne include). Falls back to null if not included (list path).
    final projectMedia = (project?['media'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .toList() ??
        const [];
    final projectCoverImageUrl = projectMedia.isNotEmpty
        ? projectMedia.first['url'] as String?
        : null;

    return StaffUnitDto(
      id: json['id'] as String,
      code: json['code'] as String? ?? '',
      status: json['status'] as String? ?? 'AVAILABLE',
      type: json['type'] as String?,
      price: json['price']?.toString(),
      area: json['area']?.toString(),
      bedrooms: (json['bedrooms'] as num?)?.toInt(),
      bathrooms: (json['bathrooms'] as num?)?.toInt(),
      floor: (json['floor'] as num?)?.toInt(),
      coverImage: mediaUrls.isNotEmpty ? mediaUrls.first : null,
      mediaUrls: mediaUrls,
      projectId: project?['id'] as String?,
      projectNameAr: projNameAr,
      projectNameEn: projNameEn,
      projectCity: project?['city'] as String?,
      projectCoverImageUrl: projectCoverImageUrl,
    );
  }

  static (String?, String?) _parseTranslatable(Object? raw) {
    if (raw is Map<String, dynamic>) {
      return (raw['ar'] as String?, raw['en'] as String?);
    }
    if (raw is String) return (raw, raw);
    return (null, null);
  }
}
