import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../dtos/company_discovery_dtos.dart';

/// Raw network access to the PlatformPublic company discovery endpoints.
/// No Authorization or X-Tenant-Slug headers — anonymous discovery calls.
abstract interface class CompanyDiscoveryRemoteDataSource {
  Future<List<DiscoveredCompanyDto>> search(String query);
  Future<DiscoveredCompanyDto?> resolveBySlug(String slug);
}

class CompanyDiscoveryRemoteDataSourceImpl
    implements CompanyDiscoveryRemoteDataSource {
  CompanyDiscoveryRemoteDataSourceImpl(this._dio);

  final Dio _dio;

  // Bypass auth interceptor — these are anonymous platform-public endpoints.
  static final Options _anon =
      Options(extra: const {AuthInterceptor.skipAuthExtra: true});

  @override
  Future<List<DiscoveredCompanyDto>> search(String query) async {
    final res = await _dio.get<List<dynamic>>(
      '/public/companies/search',
      queryParameters: {'q': query},
      options: _anon,
    );
    return (res.data ?? [])
        .cast<Map<String, dynamic>>()
        .map(DiscoveredCompanyDto.fromJson)
        .toList();
  }

  @override
  Future<DiscoveredCompanyDto?> resolveBySlug(String slug) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/public/companies/resolve',
        queryParameters: {'slug': slug},
        options: _anon,
      );
      if (res.data == null) return null;
      return DiscoveredCompanyDto.fromJson(res.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }
}
