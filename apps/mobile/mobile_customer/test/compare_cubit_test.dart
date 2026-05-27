import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/catalog/domain/entities/catalog_enums.dart';
import 'package:mobile_customer/features/catalog/domain/entities/unit.dart';
import 'package:mobile_customer/features/catalog/presentation/compare/compare_cubit.dart';

Unit _unit(String id) => Unit(
      id: id,
      code: id,
      type: 'Apartment',
      area: 100,
      bedrooms: 2,
      bathrooms: 1,
      price: '1000000',
      status: UnitStatus.available,
    );

void main() {
  group('CompareCubit', () {
    test('toggles add/remove and reports status', () {
      final cubit = CompareCubit();
      expect(cubit.toggle(_unit('a')), CompareToggle.added);
      expect(cubit.contains('a'), isTrue);
      expect(cubit.state, hasLength(1));

      expect(cubit.toggle(_unit('a')), CompareToggle.removed);
      expect(cubit.contains('a'), isFalse);
    });

    test('caps at maxItems', () {
      final cubit = CompareCubit();
      for (var i = 0; i < CompareCubit.maxItems; i++) {
        expect(cubit.toggle(_unit('u$i')), CompareToggle.added);
      }
      expect(cubit.isFull, isTrue);
      expect(cubit.toggle(_unit('overflow')), CompareToggle.full);
      expect(cubit.state, hasLength(CompareCubit.maxItems));
    });

    test('clear empties the selection', () {
      final cubit = CompareCubit()
        ..toggle(_unit('a'))
        ..toggle(_unit('b'));
      cubit.clear();
      expect(cubit.state, isEmpty);
    });
  });
}
