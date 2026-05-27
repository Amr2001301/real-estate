/// Public availability status of a unit. Pure-Dart domain enum.
enum UnitStatus {
  available('AVAILABLE'),
  reserved('RESERVED'),
  sold('SOLD'),
  unknown('UNKNOWN');

  const UnitStatus(this.wire);
  final String wire;

  static UnitStatus fromWire(String? value) => UnitStatus.values.firstWhere(
        (s) => s.wire == value,
        orElse: () => UnitStatus.unknown,
      );

  bool get isAvailable => this == UnitStatus.available;
}

/// Sort options for the projects listing.
enum ProjectSort {
  newest('newest'),
  oldest('oldest');

  const ProjectSort(this.wire);
  final String wire;
}

/// Sort options for the units listing.
enum UnitSort {
  newest('newest'),
  priceAsc('price_asc'),
  priceDesc('price_desc'),
  areaAsc('area_asc'),
  areaDesc('area_desc'),
  bedroomsAsc('bedrooms_asc'),
  bedroomsDesc('bedrooms_desc');

  const UnitSort(this.wire);
  final String wire;
}
