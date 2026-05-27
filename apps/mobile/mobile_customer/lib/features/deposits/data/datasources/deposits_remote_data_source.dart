import 'package:dio/dio.dart';

import '../dtos/deposit_dto.dart';

abstract interface class DepositsRemoteDataSource {
  Future<List<DepositDto>> listDeposits();
}

class DepositsRemoteDataSourceImpl implements DepositsRemoteDataSource {
  DepositsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<DepositDto>> listDeposits() async {
    final res = await _dio.get<Map<String, dynamic>>('/me/deposits');
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(DepositDto.fromJson)
        .toList();
  }
}
