import 'package:core/core_domain.dart';

import '../repositories/favorites_repository.dart';

class RemoveFavorite implements UseCase<void, String> {
  const RemoveFavorite(this._repo);
  final FavoritesRepository _repo;

  @override
  Future<Result<void>> call(String favoriteId) => _repo.remove(favoriteId);
}
