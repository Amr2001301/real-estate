import 'package:core/core_domain.dart';

/// A project as seen by staff (private `/projects`). `status` is the wire value
/// (DRAFT/PUBLISHED/ARCHIVED).
class StaffProject extends Equatable {
  const StaffProject({
    required this.id,
    required this.name,
    required this.status,
    this.city,
    this.coverImageUrl,
  });

  final String id;
  final Translatable name;
  final String status;
  final String? city;
  final String? coverImageUrl;

  @override
  List<Object?> get props => [id, name, status, city, coverImageUrl];
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
