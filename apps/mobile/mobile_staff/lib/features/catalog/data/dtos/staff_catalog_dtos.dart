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
    final name = json['name'] as Map<String, dynamic>?;
    final description = json['description'] as Map<String, dynamic>?;
    final media = (json['media'] as List?)?.whereType<Map<String, dynamic>>().toList();
    return StaffProjectDto(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'DRAFT',
      nameAr: name?['ar'] as String?,
      nameEn: name?['en'] as String?,
      descriptionAr: description?['ar'] as String?,
      descriptionEn: description?['en'] as String?,
      city: json['city'] as String?,
      coverImageUrl:
          (media != null && media.isNotEmpty) ? media.first['url'] as String? : null,
    );
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
