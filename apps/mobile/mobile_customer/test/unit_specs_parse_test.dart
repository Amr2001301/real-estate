import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/catalog/data/dtos/unit_dto.dart';
import 'package:mobile_customer/features/catalog/data/mappers/unit_mapper.dart';

/// The public unit's specs (GET /public/units/:id) reach the unit page.
void main() {
  test('a public unit keeps its specs and handover date', () {
    final unit = UnitDto.fromJson({
      'id': 'u1',
      'code': 'A-101',
      'type': 'APARTMENT',
      'area': 145,
      'bedrooms': 3,
      'bathrooms': 2,
      'price': '2500000',
      'status': 'AVAILABLE',
      'netArea': 120,
      'finishing': 'SEMI_FINISHED',
      'view': 'GARDEN',
      'orientation': 'NORTH',
      'deliveryDate': '2027-06-30',
    }).toEntity();
    expect(unit.specs.netArea, 120);
    expect(unit.specs.finishing, 'SEMI_FINISHED');
    expect(unit.specs.view, 'GARDEN');
    expect(unit.specs.orientation, 'NORTH');
    expect(unit.specs.deliveryDate, DateTime.utc(2027, 6, 30));
  });
}
