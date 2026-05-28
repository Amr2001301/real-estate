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
  });

  final String id;
  final Translatable name;
  final String status;
  final String? city;
  final String? coverImageUrl;
  final String? commissionPct;

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
