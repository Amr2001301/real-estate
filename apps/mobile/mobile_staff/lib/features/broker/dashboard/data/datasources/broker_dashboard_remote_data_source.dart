import 'package:dio/dio.dart';

import '../dtos/broker_dashboard_dto.dart';

abstract interface class BrokerDashboardRemoteDataSource {
  Future<BrokerDashboardDto> getDashboard();
}

class BrokerDashboardRemoteDataSourceImpl implements BrokerDashboardRemoteDataSource {
  BrokerDashboardRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<BrokerDashboardDto> getDashboard() async {
    final res = await _dio.get<Map<String, dynamic>>('/portal/performance');
    return BrokerDashboardDto.fromJson(res.data ?? const {});
  }
}
