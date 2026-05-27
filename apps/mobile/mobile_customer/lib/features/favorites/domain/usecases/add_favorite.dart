import 'package:core/core_domain.dart';

import '../entities/favorite.dart';
import '../repositories/favorites_repository.dart';

class AddFavoriteParams {
  const AddFavoriteParams.project(this.projectId) : unitId = null;
  const AddFavoriteParams.unit(this.unitId) : projectId = null;
  final String? projectId;
  final String? unitId;
}

class AddFavorite implements UseCase<Favorite, AddFavoriteParams> {
  const AddFavorite(this._repo);
  final FavoritesRepository _repo;

  @override
  Future<Result<Favorite>> call(AddFavoriteParams params) {
    return params.projectId != null
        ? _repo.addProject(params.projectId!)
        : _repo.addUnit(params.unitId!);
  }
}
