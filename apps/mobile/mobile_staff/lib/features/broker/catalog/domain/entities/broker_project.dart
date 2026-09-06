import 'package:core/core_domain.dart';

/// A project the broker has access to (from /portal/projects). `status` is the
/// wire value; `commissionPct` comes from the broker's access grant.
class BrokerProject extends Equatable {
  const BrokerProject({
    required this.id,
    required this.name,
    required this.status,
    this.city,
    this.coverImageUrl,
    this.commissionPct,
    this.description,
    this.lat,
    this.lng,
    this.services,
  });

  final String id;
  final Translatable name;
  final String status;
  final String? city;
  final String? coverImageUrl;
  final String? commissionPct;
  final Translatable? description;
  final double? lat;
  final double? lng;
  final List<Translatable>? services;

  @override
  List<Object?> get props => [id, name, status, city, commissionPct];
}

/// A unit the broker can see (from /portal/units). `status` is the wire value.
class BrokerUnit extends Equatable {
  const BrokerUnit({
    required this.id,
    required this.code,
    required this.status,
    this.type,
    this.price,
    this.area,
    this.bedrooms,
    this.bathrooms,
    this.floor,
    this.coverImageUrl,
    this.allImageUrls = const [],
    this.floorPlanUrls = const [],
    this.address,
    this.latitude,
    this.longitude,
    this.projectId,
    this.projectNameAr,
    this.projectNameEn,
    this.projectCity,
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
  final String? coverImageUrl;
  final List<String> allImageUrls;
  final List<String> floorPlanUrls;
  final String? address;
  final double? latitude;
  final double? longitude;
  final String? projectId;
  final String? projectNameAr;
  final String? projectNameEn;
  final String? projectCity;

  bool get hasLocation => latitude != null && longitude != null;

  String? projectName(String lang) =>
      lang == 'ar' ? (projectNameAr ?? projectNameEn) : (projectNameEn ?? projectNameAr);

  @override
  List<Object?> get props =>
      [id, code, status, type, price, area, bedrooms, bathrooms, floor, coverImageUrl];
}
