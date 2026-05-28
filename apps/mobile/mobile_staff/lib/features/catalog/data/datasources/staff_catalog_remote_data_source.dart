import 'package:dio/dio.dart';

import '../dtos/staff_catalog_dtos.dart';

abstract interface class StaffCatalogRemoteDataSource {
  Future<List<StaffProjectDto>> listProjects({String? search});
  Future<StaffProjectDto> getProject(String id);
  Future<List<StaffUnitDto>> listUnits({required String projectId});
  Future<StaffUnitDto> getUnit(String id);
}

class StaffCatalogRemoteDataSourceImpl implements StaffCatalogRemoteDataSource {
  StaffCatalogRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<StaffProjectDto>> listProjects({String? search}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/projects',
      queryParameters: {
        'page': 1,
        'pageSize': 50,
        'q': ?(search?.isNotEmpty == true ? search : null),
      },
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data.whereType<Map<String, dynamic>>().map(StaffProjectDto.fromJson).toList();
  }

  @override
  Future<StaffProjectDto> getProject(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/projects/$id');
    return StaffProjectDto.fromJson(res.data ?? const {});
  }

  @override
  Future<List<StaffUnitDto>> listUnits({required String projectId}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/units',
      queryParameters: {'page': 1, 'pageSize': 100, 'projectId': projectId},
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data.whereType<Map<String, dynamic>>().map(StaffUnitDto.fromJson).toList();
  }

  @override
  Future<StaffUnitDto> getUnit(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/units/$id');
    return StaffUnitDto.fromJson(res.data ?? const {});
  }
}
