import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/catalog/data/dtos/staff_catalog_dtos.dart';
import 'package:mobile_staff/features/catalog/data/mappers/staff_catalog_mapper.dart';

/// The staff unit's specs (GET /units/:id): the handover date is the unit's
/// own or its phase's (`effectiveDeliveryDate`), not the override alone.
void main() {
  test('a staff unit keeps its specs and the effective handover date', () {
    final unit = StaffUnitDto.fromJson({
      'id': 'u1',
      'code': 'A-101',
      'status': 'AVAILABLE',
      'gardenArea': 60,
      'landArea': 300,
      'finishing': 'CORE_AND_SHELL',
      'deliveryDate': null,
      'effectiveDeliveryDate': '2026-12-01',
    }).toEntity();
    expect(unit.specs.gardenArea, 60);
    expect(unit.specs.landArea, 300);
    expect(unit.specs.finishing, 'CORE_AND_SHELL');
    expect(unit.specs.deliveryDate, DateTime.utc(2026, 12, 1));
  });
}
