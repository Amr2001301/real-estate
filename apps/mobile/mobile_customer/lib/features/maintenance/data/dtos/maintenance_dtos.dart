// Data-layer DTOs for maintenance categories and requests. Parse only what the
// presentation needs; tolerate missing includes (e.g. the create response has
// no category/unit objects).

class MaintenanceCategoryDto {
  const MaintenanceCategoryDto({
    required this.id,
    this.nameAr,
    this.nameEn,
  });

  final String id;
  final String? nameAr;
  final String? nameEn;

  factory MaintenanceCategoryDto.fromJson(Map<String, dynamic> json) {
    final name = json['name'] as Map<String, dynamic>?;
    return MaintenanceCategoryDto(
      id: json['id'] as String,
      nameAr: name?['ar'] as String?,
      nameEn: name?['en'] as String?,
    );
  }
}

class MaintenanceRequestDto {
  const MaintenanceRequestDto({
    required this.id,
    required this.description,
    required this.status,
    required this.priority,
    this.unitCode,
    this.categoryNameAr,
    this.categoryNameEn,
    this.createdAt,
  });

  final String id;
  final String description;
  final String status;
  final String priority;
  final String? unitCode;
  final String? categoryNameAr;
  final String? categoryNameEn;
  final String? createdAt;

  factory MaintenanceRequestDto.fromJson(Map<String, dynamic> json) {
    final unit = json['unit'] as Map<String, dynamic>?;
    final category = json['category'] as Map<String, dynamic>?;
    final categoryName = category?['name'] as Map<String, dynamic>?;
    return MaintenanceRequestDto(
      id: json['id'] as String,
      description: json['description'] as String? ?? '',
      status: json['status'] as String? ?? '',
      priority: json['priority'] as String? ?? '',
      unitCode: unit?['code'] as String?,
      categoryNameAr: categoryName?['ar'] as String?,
      categoryNameEn: categoryName?['en'] as String?,
      createdAt: json['createdAt'] as String?,
    );
  }
}
