import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/catalog/data/dtos/staff_catalog_dtos.dart';
import 'package:mobile_staff/features/catalog/data/mappers/staff_catalog_mapper.dart';
import 'package:mobile_staff/features/profile/data/dtos/staff_profile_dto.dart';
import 'package:mobile_staff/features/profile/data/mappers/staff_profile_mapper.dart';

void main() {
  group('StaffProfileDto → entity', () {
    test('maps role to AppRole', () {
      final p = StaffProfileDto.fromJson({
        'id': 'u1',
        'role': 'SALES_MANAGER',
        'fullName': 'Layla',
        'email': 'l@x.com',
      }).toEntity();
      expect(p.role, AppRole.salesManager);
      expect(p.fullName, 'Layla');
    });
  });

  group('StaffProjectDto → entity', () {
    test('maps translatable name, status, cover image', () {
      final dto = StaffProjectDto.fromJson({
        'id': 'p1',
        'status': 'PUBLISHED',
        'name': {'ar': 'مشروع', 'en': 'Project'},
        'description': {'ar': 'وصف', 'en': 'Desc'},
        'city': 'Cairo',
        'media': [
          {'url': 'https://cdn/x.jpg', 'order': 0},
        ],
      });
      final project = dto.toEntity();
      expect(project.name.en, 'Project');
      expect(project.status, 'PUBLISHED');
      expect(project.city, 'Cairo');
      expect(project.coverImageUrl, 'https://cdn/x.jpg');
      expect(dto.descriptionTranslatable?.en, 'Desc');
    });
  });

  group('StaffUnitDto → entity', () {
    test('maps code/type/price/status', () {
      final unit = StaffUnitDto.fromJson({
        'id': 'u1',
        'code': 'A-101',
        'type': 'APARTMENT',
        'price': '1500000',
        'area': '120',
        'bedrooms': 3,
        'status': 'RESERVED',
      }).toEntity();
      expect(unit.code, 'A-101');
      expect(unit.price, '1500000');
      expect(unit.bedrooms, 3);
      expect(unit.status, 'RESERVED');
    });
  });
}
