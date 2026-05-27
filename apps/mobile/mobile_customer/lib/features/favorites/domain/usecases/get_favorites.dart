import 'package:core/core_domain.dart';

import '../entities/favorite.dart';
import '../repositories/favorites_repository.dart';

class GetFavorites implements UseCase<List<Favorite>, NoParams> {
  const GetFavorites(this._repo);
  final FavoritesRepository _repo;

  @override
  Future<Result<List<Favorite>>> call(NoParams params) => _repo.getFavorites();
}
