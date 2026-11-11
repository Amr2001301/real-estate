import 'package:dio/dio.dart';

import '../../domain/entities/unit_value.dart';
import '../dtos/property_row_dto.dart';
import '../dtos/unit_value_dto.dart';

/// Reads the customer's contracts (authenticated) to derive their properties.
abstract interface class MyPropertyRemoteDataSource {
  Future<List<PropertyRowDto>> listContracts();

  /// «قيمة وحدتك»: the signed units valued today (empty when the company has it off).
  Future<List<UnitValue>> unitValues();
}

class MyPropertyRemoteDataSourceImpl implements MyPropertyRemoteDataSource {
  MyPropertyRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<PropertyRowDto>> listContracts() async {
    // Backend route is `@Controller('contracts')` + `@Get('me/contracts')` =
    // `/v1/contracts/me/contracts`. The bare `/me/contracts` path 404s (no such
    // route), which left My Property permanently empty on mobile.
    final res = await _dio.get<Map<String, dynamic>>(
      '/contracts/me/contracts',
      queryParameters: {'page': 1, 'pageSize': 100},
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(PropertyRowDto.fromJson)
        .toList();
  }

  @override
  Future<List<UnitValue>> unitValues() async {
    final res = await _dio.get<Map<String, dynamic>>('/me/unit-values');
    return parseUnitValues(res.data);
  }
}
