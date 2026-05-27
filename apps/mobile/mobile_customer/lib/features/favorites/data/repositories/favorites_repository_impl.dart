import 'package:core/core.dart';

import '../../domain/entities/favorite.dart';
import '../../domain/repositories/favorites_repository.dart';
import '../datasources/favorites_remote_data_source.dart';
import '../mappers/favorite_mapper.dart';

class FavoritesRepositoryImpl implements FavoritesRepository {
  FavoritesRepositoryImpl(this._remote);
  final FavoritesRemoteDataSource _remote;

  @override
  Future<Result<List<Favorite>>> getFavorites() {
    return guardApiCall(() async {
      final dtos = await _remote.list();
      return dtos.map((d) => d.toEntity()).toList();
    });
  }

  @override
  Future<Result<Favorite>> addProject(String projectId) {
    return guardApiCall(
      () async => (await _remote.add(projectId: projectId)).toEntity(),
    );
  }

  @override
  Future<Result<Favorite>> addUnit(String unitId) {
    return guardApiCall(() async => (await _remote.add(unitId: unitId)).toEntity());
  }

  @override
  Future<Result<void>> remove(String favoriteId) {
    return guardApiCall(() => _remote.remove(favoriteId));
  }
}
