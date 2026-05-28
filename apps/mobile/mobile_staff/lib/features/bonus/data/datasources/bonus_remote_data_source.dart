import 'package:dio/dio.dart';

import '../../domain/repositories/bonus_repository.dart';
import '../dtos/bonus_entry_dto.dart';

abstract interface class BonusRemoteDataSource {
  Future<List<BonusEntryDto>> listEntries(BonusQuery query);
}

class BonusRemoteDataSourceImpl implements BonusRemoteDataSource {
  BonusRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<BonusEntryDto>> listEntries(BonusQuery query) async {
    final res = await _dio.get<List<dynamic>>(
      '/bonus-entries',
      queryParameters: {
        'status': ?query.status,
        'period': ?query.period,
      },
    );
    final data = res.data ?? const [];
    return data.whereType<Map<String, dynamic>>().map(BonusEntryDto.fromJson).toList();
  }
}
