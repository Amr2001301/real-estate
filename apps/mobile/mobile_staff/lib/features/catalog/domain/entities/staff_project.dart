import 'package:core/core_domain.dart';

/// A project as seen by staff. `status` is the wire value (DRAFT/PUBLISHED/ARCHIVED).
///
/// Unit aggregate fields are enriched by the backend staff serializer on the
/// list endpoint, and null/empty when no units exist yet.
///
/// `mediaUrls` contains all project media images ordered by `order`.
///
/// Fields absent from schema (gracefully omitted everywhere):
///   • currency     — no column
///   • deliveryDate — no column on Project or Phase
///   • address      — only on Unit, not at Project level
class StaffProject extends Equatable {
  const StaffProject({
    required this.id,
    required this.name,
    required this.status,
    this.description,
    this.city,
    this.coverImageUrl,
    this.mediaUrls = const [],
    this.availableUnitsCount,
    this.totalUnitsCount,
    this.soldUnitsCount,
    this.startingPrice,
    this.unitTypes = const [],
  });

  final String id;
  final Translatable name;
  final String status;
  final Translatable? description;
  final String? city;
  final String? coverImageUrl;
  final List<String> mediaUrls;
  final int? availableUnitsCount;
  final int? totalUnitsCount;
  final int? soldUnitsCount;
  final double? startingPrice;
  final List<String> unitTypes;

  @override
  List<Object?> get props => [
        id,
        name,
        status,
        description,
        city,
        coverImageUrl,
        mediaUrls,
        availableUnitsCount,
        totalUnitsCount,
        soldUnitsCount,
        startingPrice,
        unitTypes,
      ];
}

/// A unit as seen by staff. `price` and `area` are raw strings (Decimal/Float
/// from Prisma). `status` is the wire value (AVAILABLE/RESERVED/SOLD).
///
/// `coverImage` / `mediaUrls` come from the unit's own media array.
/// `projectCoverImageUrl` is the first project media image (only populated
/// on the unit-detail endpoint, which includes project.media; null on list).
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
    this.projectId,
    this.projectName,
    this.projectCity,
    this.projectCoverImageUrl,
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
  final String? projectId;
  final Translatable? projectName;
  final String? projectCity;
  final String? projectCoverImageUrl;

  String? get heroImageUrl => coverImage ?? projectCoverImageUrl;

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
        projectId,
        projectName,
        projectCity,
        projectCoverImageUrl,
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
