import 'package:dio/dio.dart';

import '../dtos/contract_dto.dart';

abstract interface class ContractsRemoteDataSource {
  Future<List<ContractDto>> listContracts();
}

class ContractsRemoteDataSourceImpl implements ContractsRemoteDataSource {
  ContractsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<ContractDto>> listContracts() async {
    // Backend route is `@Controller('contracts')` + `@Get('me/contracts')` =
    // `/v1/contracts/me/contracts`. The bare `/me/contracts` path 404s.
    final res = await _dio.get<Map<String, dynamic>>(
      '/contracts/me/contracts',
      queryParameters: {'page': 1, 'pageSize': 100},
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(ContractDto.fromJson)
        .toList();
  }
}
