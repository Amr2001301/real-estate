import 'package:core/core_domain.dart';

/// A project as seen by staff (private `/projects`). `status` is the wire value
/// (DRAFT/PUBLISHED/ARCHIVED).
///
/// Unit aggregate fields (`availableUnitsCount`, `totalUnitsCount`,
/// `soldUnitsCount`, `startingPrice`, `unitTypes`) are enriched by the backend
/// staff serializer and are null/empty when no units exist yet.
///
/// Fields deliberately absent (not in the backend schema):
///   • currency     — no column exists
///   • deliveryDate — no column on Project or Phase
///   • address      — only on Unit, not at Project level
class StaffProject extends Equatable {
  const StaffProject({
    required this.id,
    required this.name,
    required this.status,
    this.city,
    this.coverImageUrl,
    this.availableUnitsCount,
    this.totalUnitsCount,
    this.soldUnitsCount,
    this.startingPrice,
    this.unitTypes = const [],
  });

  final String id;
  final Translatable name;
  final String status;
  final String? city;
  final String? coverImageUrl;
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
        city,
        coverImageUrl,
        availableUnitsCount,
        totalUnitsCount,
        soldUnitsCount,
        startingPrice,
        unitTypes,
      ];
}

/// A unit as seen by staff (private `/units`). `price` stays a raw string;
/// `status` is the wire value (AVAILABLE/RESERVED/SOLD).
class StaffUnit extends Equatable {
  const StaffUnit({
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

  @override
  List<Object?> get props => [id, code, status, type, price, area, bedrooms];
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
