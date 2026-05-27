import 'package:dio/dio.dart';

import '../dtos/property_row_dto.dart';

/// Reads the customer's contracts (authenticated) to derive their properties.
abstract interface class MyPropertyRemoteDataSource {
  Future<List<PropertyRowDto>> listContracts();
}

class MyPropertyRemoteDataSourceImpl implements MyPropertyRemoteDataSource {
  MyPropertyRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<PropertyRowDto>> listContracts() async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/me/contracts',
      queryParameters: {'page': 1, 'pageSize': 100},
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(PropertyRowDto.fromJson)
        .toList();
  }
}
