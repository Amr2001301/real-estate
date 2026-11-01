import 'package:equatable/equatable.dart';

/// EE2 / EE5 — a unit's specs as the website shows them (UnitSpecs.tsx):
/// the areas beyond the gross one, finishing, view, orientation and the
/// handover date (the unit's own, else its phase's). Every field is
/// optional; only those a unit has are shown.
class UnitSpecs extends Equatable {
  const UnitSpecs({
    this.netArea,
    this.gardenArea,
    this.roofArea,
    this.terraceArea,
    this.landArea,
    this.finishing,
    this.view,
    this.orientation,
    this.deliveryDate,
  });

  /// Reads a unit payload. The public unit carries the handover date as
  /// `deliveryDate`; the staff unit as `effectiveDeliveryDate` (its own
  /// `deliveryDate` is only the override) — pass [deliveryKey] for that.
  factory UnitSpecs.fromJson(Map<String, dynamic> json, {String deliveryKey = 'deliveryDate'}) {
    num? area(Object? v) {
      final n = v is num ? v : (v is String ? num.tryParse(v) : null);
      return n != null && n > 0 ? n : null;
    }

    String? word(Object? v) => v is String && v.trim().isNotEmpty ? v.trim() : null;
    final day = word(json[deliveryKey]);
    return UnitSpecs(
      netArea: area(json['netArea']),
      gardenArea: area(json['gardenArea']),
      roofArea: area(json['roofArea']),
      terraceArea: area(json['terraceArea']),
      landArea: area(json['landArea']),
      finishing: word(json['finishing']),
      view: word(json['view']),
      orientation: word(json['orientation']),
      // A day ("2027-06-30", or its ISO midnight): kept as that calendar day.
      deliveryDate: day == null ? null : DateTime.tryParse('${day.substring(0, day.length < 10 ? day.length : 10)}T00:00:00Z'),
    );
  }

  final num? netArea;
  final num? gardenArea;
  final num? roofArea;
  final num? terraceArea;
  final num? landArea;

  /// CORE_AND_SHELL, SEMI_FINISHED, FULLY_FINISHED, FURNISHED.
  final String? finishing;

  /// GARDEN, POOL, LAGOON, SEA, NILE, CLUB, LANDSCAPE, MAIN_STREET, SIDE_STREET.
  final String? view;

  /// NORTH, SOUTH, EAST, WEST and the four between.
  final String? orientation;

  /// The handover day (UTC midnight).
  final DateTime? deliveryDate;

  bool get isEmpty =>
      netArea == null &&
      gardenArea == null &&
      roofArea == null &&
      terraceArea == null &&
      landArea == null &&
      finishing == null &&
      view == null &&
      orientation == null &&
      deliveryDate == null;

  @override
  List<Object?> get props => [netArea, gardenArea, roofArea, terraceArea, landArea, finishing, view, orientation, deliveryDate];
}
