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
  });

  final String id;
  final String status;
  final String? nameAr;
  final String? nameEn;
  final String? descriptionAr;
  final String? descriptionEn;
  final String? city;
  final String? coverImageUrl;

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
      coverImageUrl:
          (media != null && media.isNotEmpty) ? media.first['url'] as String? : null,
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
