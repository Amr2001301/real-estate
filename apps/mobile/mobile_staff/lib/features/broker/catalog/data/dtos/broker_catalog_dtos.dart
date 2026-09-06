// Wire shapes for /portal/projects and /portal/units. Data layer only.

class BrokerProjectDto {
  const BrokerProjectDto({
    required this.id,
    required this.status,
    this.nameAr,
    this.nameEn,
    this.city,
    this.coverImageUrl,
    this.commissionPct,
    this.descriptionAr,
    this.descriptionEn,
    this.lat,
    this.lng,
    this.services,
  });

  final String id;
  final String status;
  final String? nameAr;
  final String? nameEn;
  final String? city;
  final String? coverImageUrl;
  final String? commissionPct;
  final String? descriptionAr;
  final String? descriptionEn;
  final double? lat;
  final double? lng;
  final List<Map<String, dynamic>>? services;

  /// /portal/projects rows are `{project{...}, access{commissionPct,...}}`.
  factory BrokerProjectDto.fromJson(Map<String, dynamic> json) {
    final project = json['project'] as Map<String, dynamic>? ?? json;
    final access = json['access'] as Map<String, dynamic>?;
    // LocaleInterceptor may flatten {ar,en} → resolved string
    String? nameAr, nameEn;
    final nameRaw = project['name'];
    if (nameRaw is Map<String, dynamic>) {
      nameAr = nameRaw['ar'] as String?;
      nameEn = nameRaw['en'] as String?;
    } else if (nameRaw is String) {
      nameAr = nameRaw;
      nameEn = nameRaw;
    }
    final media = (project['media'] as List?)?.whereType<Map<String, dynamic>>().toList();
    // description — same locale-tolerant pattern as name
    String? descAr, descEn;
    final descRaw = project['description'];
    if (descRaw is Map<String, dynamic>) {
      descAr = descRaw['ar'] as String?;
      descEn = descRaw['en'] as String?;
    } else if (descRaw is String && descRaw.isNotEmpty) {
      descAr = descRaw;
      descEn = descRaw;
    }

    // services — Json array of Translatable objects
    final servicesList = (project['services'] as List?)
        ?.whereType<Map<String, dynamic>>()
        .toList();

    return BrokerProjectDto(
      id: project['id'] as String,
      status: project['status'] as String? ?? 'PUBLISHED',
      nameAr: nameAr,
      nameEn: nameEn,
      city: project['city'] as String?,
      coverImageUrl: (media != null && media.isNotEmpty) ? media.first['url'] as String? : null,
      commissionPct: access?['commissionPct']?.toString(),
      descriptionAr: descAr,
      descriptionEn: descEn,
      lat: (project['lat'] as num?)?.toDouble(),
      lng: (project['lng'] as num?)?.toDouble(),
      services: servicesList,
    );
  }
}

class BrokerUnitDto {
  const BrokerUnitDto({
    required this.id,
    required this.code,
    required this.status,
    this.type,
    this.price,
    this.area,
    this.bedrooms,
    this.bathrooms,
    this.floor,
    this.coverImageUrl,
    this.allImageUrls = const [],
    this.floorPlanUrls = const [],
    this.address,
    this.latitude,
    this.longitude,
    this.projectId,
    this.projectNameAr,
    this.projectNameEn,
    this.projectCity,
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
  final String? coverImageUrl;
  final List<String> allImageUrls;
  final List<String> floorPlanUrls;
  final String? address;
  final double? latitude;
  final double? longitude;
  final String? projectId;
  final String? projectNameAr;
  final String? projectNameEn;
  final String? projectCity;

  factory BrokerUnitDto.fromJson(Map<String, dynamic> json) {
    final media = (json['media'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .toList() ??
        [];
    // Split media by type
    final images = media
        .where((m) => (m['type'] as String?) != 'FLOORPLAN')
        .map((m) => m['url'] as String?)
        .whereType<String>()
        .toList();
    final floorPlans = media
        .where((m) => (m['type'] as String?) == 'FLOORPLAN')
        .map((m) => m['url'] as String?)
        .whereType<String>()
        .toList();

    // Project info from building → phase → project
    final building = json['building'] as Map<String, dynamic>?;
    final phase = building?['phase'] as Map<String, dynamic>?;
    final project = phase?['project'] as Map<String, dynamic>?;
    final pId = phase?['projectId'] as String? ?? project?['id'] as String?;

    String? nameAr, nameEn;
    final nameRaw = project?['name'];
    if (nameRaw is Map<String, dynamic>) {
      nameAr = nameRaw['ar'] as String?;
      nameEn = nameRaw['en'] as String?;
    } else if (nameRaw is String) {
      nameAr = nameRaw;
      nameEn = nameRaw;
    }

    return BrokerUnitDto(
      id: json['id'] as String,
      code: json['code'] as String? ?? '',
      status: json['status'] as String? ?? 'AVAILABLE',
      type: json['type'] as String?,
      price: json['price']?.toString(),
      area: json['area']?.toString(),
      bedrooms: (json['bedrooms'] as num?)?.toInt(),
      bathrooms: (json['bathrooms'] as num?)?.toInt(),
      floor: (json['floor'] as num?)?.toInt(),
      coverImageUrl: images.isNotEmpty ? images.first : null,
      allImageUrls: images,
      floorPlanUrls: floorPlans,
      address: json['address'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      projectId: pId,
      projectNameAr: nameAr,
      projectNameEn: nameEn,
      projectCity: project?['city'] as String?,
    );
  }
}
