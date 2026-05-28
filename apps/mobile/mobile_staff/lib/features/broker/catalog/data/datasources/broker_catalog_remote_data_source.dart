import 'package:dio/dio.dart';

import '../dtos/broker_catalog_dtos.dart';

abstract interface class BrokerCatalogRemoteDataSource {
  Future<List<BrokerProjectDto>> listProjects();
  Future<List<BrokerUnitDto>> listUnits({String? projectId});
}

class BrokerCatalogRemoteDataSourceImpl implements BrokerCatalogRemoteDataSource {
  BrokerCatalogRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<BrokerProjectDto>> listProjects() async {
    final res = await _dio.get<List<dynamic>>('/portal/projects');
    final data = res.data ?? const [];
    return data.whereType<Map<String, dynamic>>().map(BrokerProjectDto.fromJson).toList();
  }

  @override
  Future<List<BrokerUnitDto>> listUnits({String? projectId}) async {
    final res = await _dio.get<dynamic>(
      '/portal/units',
      queryParameters: {'projectId': ?projectId},
    );
    // The endpoint may return a bare list or a paginated `{data, meta}`.
    final body = res.data;
    final list = body is Map<String, dynamic> ? (body['data'] as List? ?? const []) : (body as List? ?? const []);
    return list.whereType<Map<String, dynamic>>().map(BrokerUnitDto.fromJson).toList();
  }
}
