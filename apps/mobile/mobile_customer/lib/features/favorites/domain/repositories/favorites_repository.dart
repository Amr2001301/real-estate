import 'package:core/core_domain.dart';

import '../entities/favorite.dart';

abstract interface class FavoritesRepository {
  Future<Result<List<Favorite>>> getFavorites();
  Future<Result<Favorite>> addProject(String projectId);
  Future<Result<Favorite>> addUnit(String unitId);
  Future<Result<void>> remove(String favoriteId);
}
