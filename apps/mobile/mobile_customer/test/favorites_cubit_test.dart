import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/favorites/domain/entities/favorite.dart';
import 'package:mobile_customer/features/favorites/domain/repositories/favorites_repository.dart';
import 'package:mobile_customer/features/favorites/domain/usecases/add_favorite.dart';
import 'package:mobile_customer/features/favorites/domain/usecases/get_favorites.dart';
import 'package:mobile_customer/features/favorites/domain/usecases/remove_favorite.dart';
import 'package:mobile_customer/features/favorites/presentation/favorites_cubit.dart';

class _FakeFavoritesRepository implements FavoritesRepository {
  final List<Favorite> _items = [];
  int _seq = 0;

  @override
  Future<Result<List<Favorite>>> getFavorites() async => Result.ok(List.of(_items));

  @override
  Future<Result<Favorite>> addProject(String projectId) async {
    final fav = Favorite(
      id: 'f${_seq++}',
      targetId: projectId,
      isProject: true,
      title: const Translatable(ar: 'م', en: 'P'),
    );
    _items.add(fav);
    return Result.ok(fav);
  }

  @override
  Future<Result<Favorite>> addUnit(String unitId) async {
    final fav = Favorite(
      id: 'f${_seq++}',
      targetId: unitId,
      isProject: false,
      title: const Translatable(ar: 'و', en: 'U'),
    );
    _items.add(fav);
    return Result.ok(fav);
  }

  @override
  Future<Result<void>> remove(String favoriteId) async {
    _items.removeWhere((f) => f.id == favoriteId);
    return const Ok(null);
  }
}

void main() {
  FavoritesCubit build(_FakeFavoritesRepository repo) => FavoritesCubit(
        GetFavorites(repo),
        AddFavorite(repo),
        RemoveFavorite(repo),
      );

  group('FavoritesCubit', () {
    test('load emits empty then success', () async {
      final repo = _FakeFavoritesRepository();
      final cubit = build(repo);
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);

      await repo.addProject('p1');
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.items, hasLength(1));
    });

    test('toggleProject adds then removes', () async {
      final repo = _FakeFavoritesRepository();
      final cubit = build(repo);
      await cubit.load();

      expect(await cubit.toggleProject('p1'), isNull);
      expect(cubit.state.forProject('p1'), isNotNull);

      expect(await cubit.toggleProject('p1'), isNull);
      expect(cubit.state.forProject('p1'), isNull);
    });

    test('toggleUnit tracks unit favorites independently', () async {
      final repo = _FakeFavoritesRepository();
      final cubit = build(repo);
      await cubit.load();
      await cubit.toggleUnit('u1');
      expect(cubit.state.forUnit('u1'), isNotNull);
      expect(cubit.state.forProject('u1'), isNull);
    });

    test('clear empties state', () async {
      final repo = _FakeFavoritesRepository();
      final cubit = build(repo);
      await cubit.load();
      await cubit.toggleProject('p1');
      cubit.clear();
      expect(cubit.state.items, isEmpty);
      expect(cubit.state.status, DataStatus.initial);
    });
  });
}
