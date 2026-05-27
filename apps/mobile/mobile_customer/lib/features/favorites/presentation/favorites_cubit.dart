import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/favorite.dart';
import '../domain/usecases/add_favorite.dart';
import '../domain/usecases/get_favorites.dart';
import '../domain/usecases/remove_favorite.dart';

class FavoritesState extends Equatable {
  const FavoritesState({
    this.status = DataStatus.initial,
    this.items = const [],
    this.failure,
  });

  final DataStatus status;
  final List<Favorite> items;
  final AppFailure? failure;

  Favorite? forProject(String id) => items
      .cast<Favorite?>()
      .firstWhere((f) => f!.isProject && f.targetId == id, orElse: () => null);
  Favorite? forUnit(String id) => items
      .cast<Favorite?>()
      .firstWhere((f) => !f!.isProject && f.targetId == id, orElse: () => null);

  FavoritesState copyWith({
    DataStatus? status,
    List<Favorite>? items,
    AppFailure? failure,
  }) {
    return FavoritesState(
      status: status ?? this.status,
      items: items ?? this.items,
      failure: failure,
    );
  }

  @override
  List<Object?> get props => [status, items, failure];
}

/// App-wide favorites state (loaded after sign-in). Detail screens use it to
/// show + toggle the favorite state. Depends on use cases only.
class FavoritesCubit extends Cubit<FavoritesState> {
  FavoritesCubit(this._getFavorites, this._addFavorite, this._removeFavorite)
      : super(const FavoritesState());

  final GetFavorites _getFavorites;
  final AddFavorite _addFavorite;
  final RemoveFavorite _removeFavorite;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getFavorites(const NoParams());
    result.when(
      ok: (items) => emit(state.copyWith(
        status: items.isEmpty ? DataStatus.empty : DataStatus.success,
        items: items,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  void clear() => emit(const FavoritesState());

  /// Returns the failure (null on success). Reloads on success.
  Future<AppFailure?> toggleProject(String projectId) =>
      _toggle(state.forProject(projectId), AddFavoriteParams.project(projectId));

  Future<AppFailure?> toggleUnit(String unitId) =>
      _toggle(state.forUnit(unitId), AddFavoriteParams.unit(unitId));

  Future<AppFailure?> removeById(String favoriteId) async {
    final failure = (await _removeFavorite(favoriteId)).failureOrNull;
    if (failure != null) return failure;
    await load();
    return null;
  }

  Future<AppFailure?> _toggle(Favorite? existing, AddFavoriteParams addParams) async {
    final AppFailure? failure = existing != null
        ? (await _removeFavorite(existing.id)).failureOrNull
        : (await _addFavorite(addParams)).failureOrNull;
    if (failure != null) return failure;
    await load();
    return null;
  }
}
