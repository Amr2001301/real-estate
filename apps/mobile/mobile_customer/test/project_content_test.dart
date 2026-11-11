import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/catalog/data/dtos/project_dto.dart';
import 'package:mobile_customer/features/catalog/data/mappers/project_mapper.dart';
import 'package:mobile_customer/features/catalog/domain/entities/project.dart';
import 'package:mobile_customer/features/catalog/presentation/widgets/project_content.dart';

Map<String, dynamic> _base() => {
      'id': 'p1',
      'name': {'ar': 'كمبوند', 'en': 'Compound'},
      'description': '',
      'city': 'الرياض',
      'services': [
        {'ar': 'حمام سباحة', 'en': 'Pool'},
      ],
      'featured': false,
      'media': const [],
      'availableUnitsCount': 3,
    };

void main() {
  group('project page content', () {
    test('reads sections, FAQ, amenities and progress (also flattened strings)', () {
      final p = ProjectDetailDto.fromJson({
        ..._base(),
        'sections': [
          {'title': 'الموقع', 'body': 'دقائق من الدائري'},
        ],
        'faqs': [
          {'question': {'ar': 'أين؟', 'en': 'Where?'}, 'answer': {'ar': 'هنا', 'en': 'Here'}},
        ],
        'amenities': [
          {'name': 'حمام سباحة', 'icon': 'pool', 'group': 'INSIDE'},
          {'name': 'مدرسة', 'icon': 'school', 'group': 'AROUND'},
        ],
        'progress': {
          'overall': 66,
          'stages': [
            {'name': 'الحفر', 'percent': 100},
            {'name': 'التشطيبات', 'percent': 40},
            {'name': 'التسليم', 'percent': 0},
          ],
          'updatedAt': '2026-11-11T10:00:00.000Z',
        },
      }).toEntity();

      expect(p.sections.single.title.resolve('ar'), 'الموقع');
      expect(p.faqs.single.answer.resolve('en'), 'Here');
      expect(p.amenityTiles.map((a) => (a.icon, a.group)), [
        ('pool', AmenityGroup.inside),
        ('school', AmenityGroup.around),
      ]);
      expect(p.progress!.overall, 66);
      expect(p.progress!.isComplete, isFalse);
      expect(p.progress!.stages.map((s) => (s.isDone, s.isActive)), [(true, false), (false, true), (false, false)]);
      expect(p.progress!.updatedAt, DateTime.utc(2026, 11, 11, 10));
    });

    test('an older API (services only, no progress) still shows its amenities as ticks', () {
      final p = ProjectDetailDto.fromJson(_base()).toEntity();
      expect(p.sections, isEmpty);
      expect(p.faqs, isEmpty);
      expect(p.progress, isNull);
      expect(p.amenityTiles.single.icon, 'check');
      expect(p.amenityTiles.single.name.resolve('en'), 'Pool');
    });

    test('progress without stages is no progress', () {
      final p = ProjectDetailDto.fromJson({
        ..._base(),
        'progress': {'overall': 0, 'stages': const [], 'updatedAt': null},
      }).toEntity();
      expect(p.progress, isNull);
    });

    test('every shared amenity key has an icon', () {
      const keys = [
        'pool', 'gym', 'garden', 'park', 'tree', 'playground', 'kids', 'security', 'cctv', 'parking',
        'elevator', 'clubhouse', 'mall', 'shop', 'restaurant', 'cafe', 'mosque', 'church', 'school',
        'university', 'hospital', 'clinic', 'pharmacy', 'bank', 'sea', 'lake', 'view', 'jogging', 'bike',
        'sports', 'tennis', 'football', 'spa', 'wifi', 'solar', 'smart-home', 'generator', 'hotel',
        'office', 'metro', 'road', 'airport', 'location', 'building', 'star', 'check',
      ];
      expect(amenityIcons.keys.toList(), keys);
    });
  });
}
