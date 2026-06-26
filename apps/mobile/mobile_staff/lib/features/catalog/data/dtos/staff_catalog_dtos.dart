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
  final int? availableUnitsCount;
  final int? totalUnitsCount;
  final int? soldUnitsCount;
  // Decimal from the backend arrives as a JSON number; keep as double.
  final double? startingPrice;
  final List<String> unitTypes;

  factory StaffProjectDto.fromJson(Map<String, dynamic> json) {
    // The backend LocaleInterceptor may flatten {ar, en} → String when
    // Accept-Language is set. Handle both Map and String defensively.
    final (nameAr, nameEn) = _parseTranslatable(json['name']);
    final (descAr, descEn) = _parseTranslatable(json['description']);
    final media =
        (json['media'] as List?)?.whereType<Map<String, dynamic>>().toList();
    return StaffProjectDto(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'DRAFT',
      nameAr: nameAr,
      nameEn: nameEn,
      descriptionAr: descAr,
      descriptionEn: descEn,
      city: json['city'] as String?,
      // Backend now returns a flat `coverImageUrl` field; fall back to
      // reading media[0].url for backward compatibility.
      coverImageUrl: json['coverImageUrl'] as String? ??
          (media != null && media.isNotEmpty
              ? media.first['url'] as String?
              : null),
      availableUnitsCount: (json['availableUnitsCount'] as num?)?.toInt(),
      totalUnitsCount: (json['totalUnitsCount'] as num?)?.toInt(),
      soldUnitsCount: (json['soldUnitsCount'] as num?)?.toInt(),
      startingPrice: (json['startingPrice'] as num?)?.toDouble(),
      unitTypes: (json['unitTypes'] as List?)?.whereType<String>().toList() ??
          const [],
    );
  }

  /// Returns `(ar, en)` from a translatable field that is either:
  ///   • `Map<String, dynamic>` → `{"ar": "...", "en": "..."}`
  ///   • `String` → already flattened by the locale interceptor (both slots)
  ///   • `null` → `(null, null)`
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
  });

  final String id;
  final String code;
  final String status;
  final String? type;
  final String? price;
  final String? area;
  final int? bedrooms;

  factory StaffUnitDto.fromJson(Map<String, dynamic> json) => StaffUnitDto(
        id: json['id'] as String,
        code: json['code'] as String? ?? '',
        status: json['status'] as String? ?? 'AVAILABLE',
        type: json['type'] as String?,
        price: json['price']?.toString(),
        area: json['area']?.toString(),
        bedrooms: (json['bedrooms'] as num?)?.toInt(),
      );
}
