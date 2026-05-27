import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../dtos/project_dto.dart';
import '../dtos/unit_dto.dart';

/// Raw network access to the public catalog. Returns DTOs and may throw
/// `DioException` — the repository implementation maps errors to AppFailure.
abstract interface class CatalogRemoteDataSource {
  Future<Paginated<ProjectListItemDto>> listProjects(Map<String, dynamic> query);
  Future<ProjectDetailDto> getProject(String id);
  Future<Paginated<UnitDto>> listUnits(Map<String, dynamic> query);
  Future<UnitDto> getUnit(String id);
}

class CatalogRemoteDataSourceImpl implements CatalogRemoteDataSource {
  CatalogRemoteDataSourceImpl(this._dio);

  final Dio _dio;
  static final Options _public =
      Options(extra: const {AuthInterceptor.skipAuthExtra: true});

  @override
  Future<Paginated<ProjectListItemDto>> listProjects(
      Map<String, dynamic> query) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/public/projects',
      queryParameters: query,
      options: _public,
    );
    return Paginated.fromJson(res.data!, ProjectListItemDto.fromJson);
  }

  @override
  Future<ProjectDetailDto> getProject(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/public/projects/$id',
      options: _public,
    );
    return ProjectDetailDto.fromJson(res.data!);
  }

  @override
  Future<Paginated<UnitDto>> listUnits(Map<String, dynamic> query) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/public/units',
      queryParameters: query,
      options: _public,
    );
    return Paginated.fromJson(res.data!, UnitDto.fromJson);
  }

  @override
  Future<UnitDto> getUnit(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/public/units/$id',
      options: _public,
    );
    return UnitDto.fromJson(res.data!);
  }
}
