import 'package:dio/dio.dart';

import '../../domain/repositories/broker_commissions_repository.dart';
import '../dtos/broker_commission_dto.dart';

abstract interface class BrokerCommissionsRemoteDataSource {
  Future<List<BrokerCommissionDto>> list(BrokerCommissionsQuery query);
}

class BrokerCommissionsRemoteDataSourceImpl implements BrokerCommissionsRemoteDataSource {
  BrokerCommissionsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<BrokerCommissionDto>> list(BrokerCommissionsQuery query) async {
    final res = await _dio.get<dynamic>(
      '/portal/commissions',
      queryParameters: {'status': ?query.status},
    );
    final body = res.data;
    final list = body is Map<String, dynamic> ? (body['data'] as List? ?? const []) : (body as List? ?? const []);
    return list.whereType<Map<String, dynamic>>().map(BrokerCommissionDto.fromJson).toList();
  }
}
