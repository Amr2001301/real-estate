import 'package:dio/dio.dart';

import '../dtos/favorite_dto.dart';

/// Raw network access to `/me/favorites` (authenticated). May throw.
abstract interface class FavoritesRemoteDataSource {
  Future<List<FavoriteDto>> list();
  Future<FavoriteDto> add({String? projectId, String? unitId});
  Future<void> remove(String favoriteId);
}

class FavoritesRemoteDataSourceImpl implements FavoritesRemoteDataSource {
  FavoritesRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<FavoriteDto>> list() async {
    final res = await _dio.get<List<dynamic>>('/me/favorites');
    return (res.data ?? [])
        .whereType<Map<String, dynamic>>()
        .map(FavoriteDto.fromJson)
        .toList();
  }

  @override
  Future<FavoriteDto> add({String? projectId, String? unitId}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/me/favorites',
      data: {'projectId': ?projectId, 'unitId': ?unitId},
    );
    return FavoriteDto.fromJson(res.data!);
  }

  @override
  Future<void> remove(String favoriteId) async {
    await _dio.delete<dynamic>('/me/favorites/$favoriteId');
  }
}
