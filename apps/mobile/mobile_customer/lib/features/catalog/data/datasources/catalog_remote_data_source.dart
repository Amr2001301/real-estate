import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../dtos/project_dto.dart';
import '../dtos/unit_dto.dart';

/// Reads the selected company slug (or null when no selection).
typedef CatalogSlugReader = Future<String?> Function();

/// Raw network access to the public catalog. Returns DTOs and may throw
/// `DioException` — the repository maps errors to AppFailure.
///
/// When [readTenantSlug] is provided (K2 active), public catalog requests
/// carry `X-Tenant-Slug` so the backend MT-053 resolver scopes inventory to
/// the selected company. Without the header the backend falls back to
/// DEFAULT_COMPANY_ID (K1 / legacy released clients).
abstract interface class CatalogRemoteDataSource {
  Future<Paginated<ProjectListItemDto>> listProjects(Map<String, dynamic> query);
  Future<ProjectDetailDto> getProject(String id);
  Future<Paginated<UnitDto>> listUnits(Map<String, dynamic> query);
  Future<UnitDto> getUnit(String id);
}

class CatalogRemoteDataSourceImpl implements CatalogRemoteDataSource {
  CatalogRemoteDataSourceImpl(this._dio, {CatalogSlugReader? readTenantSlug})
      : _readTenantSlug = readTenantSlug;

  final Dio _dio;
  final CatalogSlugReader? _readTenantSlug;

  static const _tenantHeader = 'X-Tenant-Slug';

  // Builds request options for a public catalog call: skips bearer injection
  // and optionally adds X-Tenant-Slug from the selected company.
  Future<Options> _publicOptions() async {
    final slug = await _readTenantSlug?.call();
    return Options(
      extra: const {AuthInterceptor.skipAuthExtra: true},
      headers: (slug != null && slug.isNotEmpty) ? {_tenantHeader: slug} : null,
    );
  }

  @override
  Future<Paginated<ProjectListItemDto>> listProjects(
      Map<String, dynamic> query) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/public/projects',
      queryParameters: query,
      options: await _publicOptions(),
    );
    return Paginated.fromJson(res.data!, ProjectListItemDto.fromJson);
  }

  @override
  Future<ProjectDetailDto> getProject(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/public/projects/$id',
      options: await _publicOptions(),
    );
    return ProjectDetailDto.fromJson(res.data!);
  }

  @override
  Future<Paginated<UnitDto>> listUnits(Map<String, dynamic> query) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/public/units',
      queryParameters: query,
      options: await _publicOptions(),
    );
    return Paginated.fromJson(res.data!, UnitDto.fromJson);
  }

  @override
  Future<UnitDto> getUnit(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/public/units/$id',
      options: await _publicOptions(),
    );
    return UnitDto.fromJson(res.data!);
  }
}
