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
  });

  final String id;
  final String status;
  final String? nameAr;
  final String? nameEn;
  final String? city;
  final String? coverImageUrl;
  final String? commissionPct;

  /// /portal/projects rows are `{project{...}, access{commissionPct,...}}`.
  factory BrokerProjectDto.fromJson(Map<String, dynamic> json) {
    final project = json['project'] as Map<String, dynamic>? ?? json;
    final access = json['access'] as Map<String, dynamic>?;
    final name = project['name'] as Map<String, dynamic>?;
    final media = (project['media'] as List?)?.whereType<Map<String, dynamic>>().toList();
    return BrokerProjectDto(
      id: project['id'] as String,
      status: project['status'] as String? ?? 'PUBLISHED',
      nameAr: name?['ar'] as String?,
      nameEn: name?['en'] as String?,
      city: project['city'] as String?,
      coverImageUrl: (media != null && media.isNotEmpty) ? media.first['url'] as String? : null,
      commissionPct: access?['commissionPct']?.toString(),
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
  });

  final String id;
  final String code;
  final String status;
  final String? type;
  final String? price;
  final String? area;
  final int? bedrooms;

  /// /portal/units rows may be the unit directly or `{...unit, accessSource}`.
  factory BrokerUnitDto.fromJson(Map<String, dynamic> json) => BrokerUnitDto(
        id: json['id'] as String,
        code: json['code'] as String? ?? '',
        status: json['status'] as String? ?? 'AVAILABLE',
        type: json['type'] as String?,
        price: json['price']?.toString(),
        area: json['area']?.toString(),
        bedrooms: (json['bedrooms'] as num?)?.toInt(),
      );
}
