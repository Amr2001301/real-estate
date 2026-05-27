import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/catalog/data/dtos/project_dto.dart';
import 'package:mobile_customer/features/catalog/data/dtos/unit_dto.dart';
import 'package:mobile_customer/features/catalog/data/mappers/project_mapper.dart';
import 'package:mobile_customer/features/catalog/data/mappers/unit_mapper.dart';
import 'package:mobile_customer/features/catalog/domain/entities/catalog_enums.dart';

void main() {
  group('UnitDto → Unit mapper', () {
    test('maps fields and wire status to the domain enum', () {
      final dto = UnitDto.fromJson({
        'id': 'u1',
        'code': 'A-101',
        'type': 'Apartment',
        'area': 180,
        'bedrooms': 3,
        'bathrooms': 2,
        'floor': 4,
        'price': '5800000',
        'status': 'AVAILABLE',
        'media': [
          {'url': 'http://img/1.jpg', 'type': 'IMAGE', 'order': 0},
        ],
        'project': {'id': 'p1', 'name': {'ar': 'مشروع', 'en': 'Proj'}, 'city': 'Cairo'},
      });
      final unit = dto.toEntity();
      expect(unit.id, 'u1');
      expect(unit.status, UnitStatus.available);
      expect(unit.priceValue, 5800000);
      expect(unit.project?.name.resolve('en'), 'Proj');
      expect(unit.galleryImages, ['http://img/1.jpg']);
    });

    test('unknown wire status falls back to UnitStatus.unknown', () {
      final unit = UnitDto.fromJson({
        'id': 'u', 'code': '', 'type': '', 'area': 0,
        'bedrooms': 0, 'bathrooms': 0, 'price': '0', 'status': 'WAT',
      }).toEntity();
      expect(unit.status, UnitStatus.unknown);
    });
  });

  group('ProjectDetailDto → ProjectDetail mapper', () {
    test('maps translatable + media gallery', () {
      final detail = ProjectDetailDto.fromJson({
        'id': 'p1',
        'name': {'ar': 'أبراج', 'en': 'Towers'},
        'description': {'ar': 'وصف', 'en': 'Desc'},
        'city': 'Cairo',
        'lat': 30.0,
        'lng': 31.0,
        'services': [
          {'ar': 'مسبح', 'en': 'Pool'},
        ],
        'featured': true,
        'media': [
          {'url': 'a.jpg', 'type': 'IMAGE', 'order': 1},
          {'url': 'b.jpg', 'type': 'IMAGE', 'order': 0},
        ],
        'availableUnitsCount': 5,
      }).toEntity();

      expect(detail.name.resolve('ar'), 'أبراج');
      expect(detail.hasLocation, isTrue);
      expect(detail.services.first.resolve('en'), 'Pool');
      // imageUrls sorts by order.
      expect(detail.galleryImages, ['b.jpg', 'a.jpg']);
    });
  });
}
