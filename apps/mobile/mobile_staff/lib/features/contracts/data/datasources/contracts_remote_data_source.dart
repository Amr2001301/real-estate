import 'package:dio/dio.dart';

import '../dtos/contract_dtos.dart';

abstract interface class StaffContractsRemoteDataSource {
  Future<List<StaffContractRowDto>> listContracts({String? q, String? status});
  Future<StaffContractDetailDto> getContract(String id);
}

class StaffContractsRemoteDataSourceImpl implements StaffContractsRemoteDataSource {
  StaffContractsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<StaffContractRowDto>> listContracts({String? q, String? status}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/contracts',
      queryParameters: {
        'page': 1,
        'pageSize': 50,
        'q': ?(q?.isNotEmpty == true ? q : null),
        'status': ?status,
      },
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(StaffContractRowDto.fromJson)
        .toList();
  }

  @override
  Future<StaffContractDetailDto> getContract(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/contracts/$id');
    return StaffContractDetailDto.fromJson(res.data ?? const {});
  }
}
