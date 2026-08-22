import 'package:core/core_domain.dart';

/// A project as seen by staff. `status` is the wire value (DRAFT/PUBLISHED/ARCHIVED).
class StaffProject extends Equatable {
  const StaffProject({
    required this.id,
    required this.name,
    required this.status,
    this.description,
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
  final Translatable name;
  final String status;
  final Translatable? description;
  final String? city;
  final String? coverImageUrl;
  final List<String> mediaUrls;
  final List<String> floorPlanUrls;
  final int? availableUnitsCount;
  final int? totalUnitsCount;
  final int? soldUnitsCount;
  final double? startingPrice;
  final List<String> unitTypes;
  final double? lat;
  final double? lng;
  final List<String> services;

  bool get hasLocation => lat != null && lng != null;

  @override
  List<Object?> get props => [
        id,
        name,
        status,
        description,
        city,
        coverImageUrl,
        mediaUrls,
        floorPlanUrls,
        availableUnitsCount,
        totalUnitsCount,
        soldUnitsCount,
        startingPrice,
        unitTypes,
        lat,
        lng,
        services,
      ];
}

/// A unit as seen by staff.
class StaffUnit extends Equatable {
  const StaffUnit({
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
    this.projectName,
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
  final List<String> mediaUrls;
  final List<String> floorPlanUrls;
  final List<StaffMaintenanceItem> maintenanceItems;
  final String? projectId;
  final Translatable? projectName;
  final String? projectCity;
  final String? projectCoverImageUrl;
  final double? latitude;
  final double? longitude;
  final String? address;

  String? get heroImageUrl => coverImage ?? projectCoverImageUrl;
  bool get hasLocation => latitude != null && longitude != null;

  @override
  List<Object?> get props => [
        id,
        code,
        status,
        type,
        price,
        area,
        bedrooms,
        bathrooms,
        floor,
        coverImage,
        mediaUrls,
        floorPlanUrls,
        maintenanceItems,
        projectId,
        projectName,
        projectCity,
        projectCoverImageUrl,
        latitude,
        longitude,
        address,
      ];
}

/// A warranty/maintenance component of a unit (AC, plumbing, doors, …).
class StaffMaintenanceItem extends Equatable {
  const StaffMaintenanceItem({
    required this.id,
    required this.name,
    this.categoryName,
    this.warrantyStart,
    this.warrantyEnd,
    this.warrantyDurationMonths,
    this.supplierName,
    this.contractorName,
    this.notes,
  });

  final String id;
  final Translatable name;
  final Translatable? categoryName;
  final DateTime? warrantyStart;
  final DateTime? warrantyEnd;
  final int? warrantyDurationMonths;
  final String? supplierName;
  final String? contractorName;
  final String? notes;

  bool get hasWarrantyDates => warrantyStart != null && warrantyEnd != null;
  bool get isUnderWarranty =>
      warrantyEnd != null && warrantyEnd!.isAfter(DateTime.now());

  @override
  List<Object?> get props => [
        id,
        name,
        categoryName,
        warrantyStart,
        warrantyEnd,
        warrantyDurationMonths,
        supplierName,
        contractorName,
        notes,
      ];
}

/// A project plus its description and units (for the staff detail screen).
class StaffProjectDetail extends Equatable {
  const StaffProjectDetail({
    required this.project,
    required this.units,
    this.description,
  });

  final StaffProject project;
  final List<StaffUnit> units;
  final Translatable? description;

  @override
  List<Object?> get props => [project, units, description];
}
