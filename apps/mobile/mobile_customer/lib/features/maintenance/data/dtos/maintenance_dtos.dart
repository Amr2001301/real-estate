import 'package:core/core_domain.dart';

// Data-layer DTOs for maintenance categories and requests. Parse only what the
// presentation needs; tolerate missing includes (e.g. the create response has
// no category/unit objects).

class MaintenanceCategoryDto {
  const MaintenanceCategoryDto({required this.id, this.nameAr, this.nameEn});

  final String id;
  final String? nameAr;
  final String? nameEn;

  factory MaintenanceCategoryDto.fromJson(Map<String, dynamic> json) {
    final name = Translatable.fromJson(json['name']);
    return MaintenanceCategoryDto(
      id: json['id'] as String,
      nameAr: name.ar,
      nameEn: name.en,
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
    // Tolerant: the locale interceptor may flatten `name` to a localized string.
    final categoryName = Translatable.fromJson(category?['name']);
    return MaintenanceRequestDto(
      id: json['id'] as String,
      description: json['description'] as String? ?? '',
      status: json['status'] as String? ?? '',
      priority: json['priority'] as String? ?? '',
      unitCode: unit?['code'] as String?,
      // Empty → null so the mapper's `!= null` category check stays accurate.
      categoryNameAr: categoryName.ar.isEmpty ? null : categoryName.ar,
      categoryNameEn: categoryName.en.isEmpty ? null : categoryName.en,
      createdAt: json['createdAt'] as String?,
      dueAt: json['dueAt'] as String?,
      complaintAt: json['complaintAt'] as String?,
      unresolvedAt: json['unresolvedAt'] as String?,
      customerConfirmedResolutionAt:
          json['customerConfirmedResolutionAt'] as String?,
      supervisorConfirmedResolutionAt:
          json['supervisorConfirmedResolutionAt'] as String?,
      resolvedBy: json['resolvedBy'] as String?,
      customerRating: (json['customerRating'] as num?)?.toInt(),
      customerRatingText: json['customerRatingText'] as String?,
      customerRatingSubmittedAt: json['customerRatingSubmittedAt'] as String?,
    );
  }
}
