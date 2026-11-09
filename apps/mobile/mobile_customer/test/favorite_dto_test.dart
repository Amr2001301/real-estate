import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/favorites/data/dtos/favorite_dto.dart';

/// The favourites list embeds raw rows; a name arrives as {ar, en} or, flattened
/// for the language, as a plain string, and a unit carries no project name.
void main() {
  test('a project favourite reads a flattened name', () {
    final dto = FavoriteDto.fromJson({
      'id': 'f1',
      'projectId': 'p1',
      'project': {'name': 'ذا أفنيو', 'city': 'الدمام', 'media': <dynamic>[]},
    });
    expect(dto.isProject, isTrue);
    expect(dto.titleAr, 'ذا أفنيو');
    expect(dto.subtitle, 'الدمام');
  });

  test('a project favourite reads a {ar, en} name and its cover', () {
    final dto = FavoriteDto.fromJson({
      'id': 'f1',
      'projectId': 'p1',
      'project': {
        'name': {'ar': 'ذا أفنيو', 'en': 'The Avenue'},
        'city': 'Dammam',
        'media': [
          {'url': 'https://x/y.jpg'},
        ],
      },
    });
    expect(dto.titleEn, 'The Avenue');
    expect(dto.coverImage, 'https://x/y.jpg');
  });

  test('a unit favourite falls back to the unit code when no project is embedded', () {
    final dto = FavoriteDto.fromJson({
      'id': 'f2',
      'unitId': 'u1',
      'unit': {'code': 'A-101', 'type': '1BR'},
    });
    expect(dto.isProject, isFalse);
    expect(dto.titleAr, 'A-101');
    expect(dto.subtitle, '1BR');
  });
}
