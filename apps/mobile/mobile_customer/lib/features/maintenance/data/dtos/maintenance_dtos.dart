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
    this.dueAt,
    this.complaintAt,
    this.unresolvedAt,
    this.customerConfirmedResolutionAt,
    this.supervisorConfirmedResolutionAt,
    this.resolvedBy,
    this.customerRating,
    this.customerRatingText,
    this.customerRatingSubmittedAt,
  });

  final String id;
  final String description;
  final String status;
  final String priority;
  final String? unitCode;
  final String? categoryNameAr;
  final String? categoryNameEn;
  final String? createdAt;
  // Phase A — resolution loop (tolerate missing on older responses).
  final String? dueAt;
  final String? complaintAt;
  final String? unresolvedAt;
  final String? customerConfirmedResolutionAt;
  final String? supervisorConfirmedResolutionAt;
  final String? resolvedBy;
  final int? customerRating;
  final String? customerRatingText;
  final String? customerRatingSubmittedAt;

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
      dueAt: json['dueAt'] as String?,
      complaintAt: json['complaintAt'] as String?,
      unresolvedAt: json['unresolvedAt'] as String?,
      customerConfirmedResolutionAt: json['customerConfirmedResolutionAt'] as String?,
      supervisorConfirmedResolutionAt: json['supervisorConfirmedResolutionAt'] as String?,
      resolvedBy: json['resolvedBy'] as String?,
      customerRating: (json['customerRating'] as num?)?.toInt(),
      customerRatingText: json['customerRatingText'] as String?,
      customerRatingSubmittedAt: json['customerRatingSubmittedAt'] as String?,
    );
  }
}
