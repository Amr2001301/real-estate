import 'package:dio/dio.dart';

import '../dtos/broker_profile_dto.dart';

abstract interface class BrokerProfileRemoteDataSource {
  Future<BrokerProfileDto> getProfile();
}

class BrokerProfileRemoteDataSourceImpl implements BrokerProfileRemoteDataSource {
  BrokerProfileRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<BrokerProfileDto> getProfile() async {
    final res = await _dio.get<Map<String, dynamic>>('/portal/me');
    return BrokerProfileDto.fromJson(res.data ?? const {});
  }
}
