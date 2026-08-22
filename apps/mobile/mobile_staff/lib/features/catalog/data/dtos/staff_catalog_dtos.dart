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
    this.floorPlanUrls = const [],
    this.availableUnitsCount,
    this.totalUnitsCount,
    this.soldUnitsCount,
    this.startingPrice,
    this.unitTypes = const [],
    this.lat,
    this.lng,
    this.services = const [],
  });

  final String id;
  final String status;
  final String? nameAr;
  final String? nameEn;
  final String? descriptionAr;
  final String? descriptionEn;
  final String? city;
  final String? coverImageUrl;
  /// IMAGE/VIDEO media URLs (ordered by `order`).
  final List<String> mediaUrls;
  /// FLOORPLAN type media URLs (ordered by `order`).
  final List<String> floorPlanUrls;
  final int? availableUnitsCount;
  final int? totalUnitsCount;
  final int? soldUnitsCount;
  final double? startingPrice;
  final List<String> unitTypes;
  final double? lat;
  final double? lng;
  /// Amenities/services list — each entry is a resolved display string.
  final List<String> services;

  factory StaffProjectDto.fromJson(Map<String, dynamic> json) {
    final (nameAr, nameEn) = _parseTranslatable(json['name']);
    final (descAr, descEn) = _parseTranslatable(json['description']);
    final media =
        (json['media'] as List?)?.whereType<Map<String, dynamic>>().toList() ??
        const <Map<String, dynamic>>[];

    final imageUrls = <String>[];
    final floorPlanUrls = <String>[];
    for (final m in media) {
      final url = m['url'] as String? ?? '';
      if (url.isEmpty) continue;
      if (m['type'] == 'FLOORPLAN') {
        floorPlanUrls.add(url);
      } else {
        imageUrls.add(url);
      }
    }

    final services = (json['services'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map((s) {
              final ar = s['ar'] as String?;
              final en = s['en'] as String?;
              return ar ?? en ?? '';
            })
            .where((s) => s.isNotEmpty)
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
          (imageUrls.isNotEmpty ? imageUrls.first : null),
      mediaUrls: imageUrls,
      floorPlanUrls: floorPlanUrls,
      availableUnitsCount: (json['availableUnitsCount'] as num?)?.toInt(),
      totalUnitsCount: (json['totalUnitsCount'] as num?)?.toInt(),
      soldUnitsCount: (json['soldUnitsCount'] as num?)?.toInt(),
      startingPrice: (json['startingPrice'] as num?)?.toDouble(),
      unitTypes: (json['unitTypes'] as List?)?.whereType<String>().toList() ??
          const [],
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      services: services,
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
    this.floorPlanUrls = const [],
    this.maintenanceItems = const [],
    this.projectId,
    this.projectNameAr,
    this.projectNameEn,
    this.projectCity,
    this.projectCoverImageUrl,
    this.latitude,
    this.longitude,
    this.address,
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
  /// IMAGE/VIDEO media URLs (ordered by `order`).
  final List<String> mediaUrls;
  /// FLOORPLAN type media URLs (ordered by `order`).
  final List<String> floorPlanUrls;
  final List<StaffMaintenanceItemDto> maintenanceItems;
  final String? projectId;
  final String? projectNameAr;
  final String? projectNameEn;
  final String? projectCity;
  final String? projectCoverImageUrl;
  final double? latitude;
  final double? longitude;
  final String? address;

  factory StaffUnitDto.fromJson(Map<String, dynamic> json) {
    final media = (json['media'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .toList() ??
        const <Map<String, dynamic>>[];

    final imageUrls = <String>[];
    final floorPlanUrls = <String>[];
    for (final m in media) {
      final url = m['url'] as String? ?? '';
      if (url.isEmpty) continue;
      if (m['type'] == 'FLOORPLAN') {
        floorPlanUrls.add(url);
      } else {
        imageUrls.add(url);
      }
    }

    final maintenanceItems = (json['maintenanceItems'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(StaffMaintenanceItemDto.fromJson)
            .toList() ??
        const <StaffMaintenanceItemDto>[];

    // Navigate raw Prisma nesting: building → phase → project
    final building = json['building'] as Map<String, dynamic>?;
    final phase = building?['phase'] as Map<String, dynamic>?;
    final project = phase?['project'] as Map<String, dynamic>?;

    final (projNameAr, projNameEn) =
        project != null ? _parseTranslatable(project['name']) : (null, null);

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
      coverImage: imageUrls.isNotEmpty ? imageUrls.first : null,
      mediaUrls: imageUrls,
      floorPlanUrls: floorPlanUrls,
      maintenanceItems: maintenanceItems,
      projectId: project?['id'] as String?,
      projectNameAr: projNameAr,
      projectNameEn: projNameEn,
      projectCity: project?['city'] as String?,
      projectCoverImageUrl: projectCoverImageUrl,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      address: json['address'] as String?,
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

class StaffMaintenanceItemDto {
  const StaffMaintenanceItemDto({
    required this.id,
    this.nameAr,
    this.nameEn,
    this.categoryNameAr,
    this.categoryNameEn,
    this.warrantyStart,
    this.warrantyEnd,
    this.warrantyDurationMonthsSnapshot,
    this.supplierName,
    this.contractorName,
    this.notes,
  });

  final String id;
  final String? nameAr;
  final String? nameEn;
  final String? categoryNameAr;
  final String? categoryNameEn;
  final String? warrantyStart;
  final String? warrantyEnd;
  final int? warrantyDurationMonthsSnapshot;
  final String? supplierName;
  final String? contractorName;
  final String? notes;

  factory StaffMaintenanceItemDto.fromJson(Map<String, dynamic> json) {
    final (nameAr, nameEn) = _parseTranslatable(json['name']);
    final cat = json['category'] as Map<String, dynamic>?;
    final (catAr, catEn) =
        cat != null ? _parseTranslatable(cat['name']) : (null, null);
    return StaffMaintenanceItemDto(
      id: json['id'] as String,
      nameAr: nameAr,
      nameEn: nameEn,
      categoryNameAr: catAr,
      categoryNameEn: catEn,
      warrantyStart: json['warrantyStart'] as String?,
      warrantyEnd: json['warrantyEnd'] as String?,
      warrantyDurationMonthsSnapshot:
          (json['warrantyDurationMonthsSnapshot'] as num?)?.toInt(),
      supplierName: json['supplierName'] as String?,
      contractorName: json['contractorName'] as String?,
      notes: json['notes'] as String?,
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
