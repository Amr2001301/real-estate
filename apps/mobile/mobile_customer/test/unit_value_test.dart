import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/my_property/data/dtos/unit_value_dto.dart';
import 'package:mobile_customer/features/notifications/presentation/notification_route.dart';

Map<String, dynamic> _item({Object? gain = '150000.00'}) => {
      'contractId': 'c1',
      'unitCode': 'A-101',
      'projectName': {'ar': 'الريحان', 'en': 'Al Rayhan'},
      'area': 120,
      'purchasedAt': '2025-03-01T00:00:00.000Z',
      'purchasePrice': '1800000.00',
      'purchasePricePerMeter': '15000.00',
      'currentPricePerMeter': '16250.00',
      'currentValue': '1950000.00',
      'gain': gain,
      'gainPct': 8.3,
      'history': [
        {'date': '2025-03-01T00:00:00.000Z', 'pricePerMeter': 15000},
        {'date': '2026-11-11T00:00:00.000Z', 'pricePerMeter': '16250'},
      ],
    };

void main() {
  test('nothing when the company has «قيمة وحدتك» off', () {
    expect(parseUnitValues({'enabled': false, 'items': [_item()]}), isEmpty);
    expect(parseUnitValues(null), isEmpty);
  });

  test('parses a valued unit, a flattened name and string or number rates', () {
    final v = parseUnitValues({'enabled': true, 'items': [_item(), {..._item(), 'contractId': 'c2', 'projectName': 'الريحان'}]});
    expect(v, hasLength(2));
    expect(v.first.currentValue, '1950000.00');
    expect(v.first.isUp, isTrue);
    expect(v.first.history.map((p) => p.pricePerMeter), [15000, 16250]);
    expect(v.last.projectName.resolve('en'), 'الريحان');
  });

  test('a fall reads as down; a row missing its money is dropped', () {
    final v = parseUnitValues({'enabled': true, 'items': [_item(gain: '-20000.00'), _item(gain: null)]});
    expect(v, hasLength(1));
    expect(v.single.isUp, isFalse);
  });

  test('a unit-value notice opens «عقاري»', () {
    expect(customerNotificationRoute('unit_value_rise_customer', {'entityType': 'unit_value', 'contractId': 'c1'}), '/account/property');
  });
}
