import 'package:dio/dio.dart';

import '../dtos/staff_deposit_dto.dart';

abstract interface class StaffDepositsRemoteDataSource {
  Future<List<StaffDepositDto>> listDeposits({String? q, String? contractId});
  Future<void> recordDeposit({
    required String contractId,
    required String installmentId,
    required double amount,
    required String paidAt,
  });
}

class StaffDepositsRemoteDataSourceImpl implements StaffDepositsRemoteDataSource {
  StaffDepositsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<StaffDepositDto>> listDeposits({String? q, String? contractId}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/deposits',
      queryParameters: {
        'page': 1,
        'pageSize': 50,
        'q': ?q,
        'contractId': ?contractId,
      },
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(StaffDepositDto.fromJson)
        .toList();
  }

  @override
  Future<void> recordDeposit({
    required String contractId,
    required String installmentId,
    required double amount,
    required String paidAt,
  }) async {
    await _dio.post<void>('/deposits', data: {
      'contractId': contractId,
      'installmentId': installmentId,
      'amount': amount,
      'paidAt': paidAt,
    });
  }
}
