// Data-layer DTOs for supervisor maintenance. Parse only what the presentation
// needs; tolerate missing relations/fields across list vs detail responses.

class MaintenanceRequestDto {
  const MaintenanceRequestDto({
    required this.id,
    required this.description,
    required this.status,
    required this.priority,
    this.reviewStatus,
    this.customerName,
    this.customerPhone,
    this.customerEmail,
    this.unitCode,
    this.unitLat,
    this.unitLng,
    this.unitAddress,
    this.categoryNameAr,
    this.categoryNameEn,
    this.createdAt,
    this.approvedAt,
    this.assignedAt,
    this.dueAt,
    this.resolvedAt,
    this.closedAt,
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
  final String? reviewStatus;
  final String? customerName;
  final String? customerPhone;
  final String? customerEmail;
  final String? unitCode;
  final double? unitLat;
  final double? unitLng;
  final String? unitAddress;
  final String? categoryNameAr;
  final String? categoryNameEn;
  final String? createdAt;
  final String? approvedAt;
  final String? assignedAt;
  final String? dueAt;
  final String? resolvedAt;
  final String? closedAt;
  final String? complaintAt;
  final String? unresolvedAt;
  final String? customerConfirmedResolutionAt;
  final String? supervisorConfirmedResolutionAt;
  final String? resolvedBy;
  final int? customerRating;
  final String? customerRatingText;
  final String? customerRatingSubmittedAt;

  // Returns null for String/int values — tolerates backends that send name as
  // a plain string instead of the {ar, en} locale map.
  static Map<String, dynamic>? _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return null;
  }

  factory MaintenanceRequestDto.fromJson(Map<String, dynamic> json) {
    final customer = _asMap(json['customer']);
    final unit = _asMap(json['unit']);
    final category = _asMap(json['category']);
    final categoryName = _asMap(category?['name']);
    return MaintenanceRequestDto(
      id: json['id'] as String,
      description: json['description'] as String? ?? '',
      status: json['status'] as String? ?? '',
      priority: json['priority'] as String? ?? '',
      reviewStatus: json['reviewStatus'] as String?,
      customerName: customer?['fullName'] as String?,
      customerPhone: customer?['phone'] as String?,
      customerEmail: customer?['email'] as String?,
      unitCode: unit?['code'] as String?,
      // TODO(backend): unit currently only returns 'code'; lat/lng/address are
      // null until the backend includes location data in the response.
      unitLat: (unit?['lat'] as num?)?.toDouble() ??
          (unit?['latitude'] as num?)?.toDouble() ??
          (_asMap(unit?['location'])?['lat'] as num?)?.toDouble() ??
          (_asMap(unit?['location'])?['latitude'] as num?)?.toDouble(),
      unitLng: (unit?['lng'] as num?)?.toDouble() ??
          (unit?['longitude'] as num?)?.toDouble() ??
          (_asMap(unit?['location'])?['lng'] as num?)?.toDouble() ??
          (_asMap(unit?['location'])?['longitude'] as num?)?.toDouble(),
      unitAddress: unit?['address'] as String? ?? unit?['fullAddress'] as String?,
      categoryNameAr: categoryName?['ar'] as String?,
      categoryNameEn: categoryName?['en'] as String?,
      createdAt: json['createdAt'] as String?,
      approvedAt: json['approvedAt'] as String?,
      assignedAt: json['assignedAt'] as String?,
      dueAt: json['dueAt'] as String?,
      resolvedAt: json['resolvedAt'] as String?,
      closedAt: json['closedAt'] as String?,
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

class MaintenanceDocDto {
  const MaintenanceDocDto({
    required this.id,
    this.title,
    this.fileName,
    this.url,
    this.mimeType,
  });
  final String id;
  final String? title;
  final String? fileName;
  final String? url;
  final String? mimeType;

  factory MaintenanceDocDto.fromJson(Map<String, dynamic> json) => MaintenanceDocDto(
        id: json['id'] as String,
        title: json['title'] as String?,
        fileName: json['fileName'] as String?,
        // Try all common field names for pre-signed / public attachment URLs.
        // TODO(backend): documents[] currently has no download URL field.
        // Remove this comment once the backend returns url/signedUrl/downloadUrl.
        url: (json['url'] ?? json['signedUrl'] ?? json['downloadUrl'] ?? json['fileUrl']) as String?,
        mimeType: json['mimeType'] as String?,
      );
}

/// Detail response = request fields + a `documents` array.
class MaintenanceDetailDto {
  const MaintenanceDetailDto({required this.request, this.documents = const []});
  final MaintenanceRequestDto request;
  final List<MaintenanceDocDto> documents;

  factory MaintenanceDetailDto.fromJson(Map<String, dynamic> json) => MaintenanceDetailDto(
        request: MaintenanceRequestDto.fromJson(json),
        documents: ((json['documents'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(MaintenanceDocDto.fromJson)
            .toList(),
      );
}
