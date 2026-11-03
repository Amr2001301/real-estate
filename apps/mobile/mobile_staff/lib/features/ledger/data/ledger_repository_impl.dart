import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../domain/ledger.dart';

class LedgerRepositoryImpl implements LedgerRepository {
  LedgerRepositoryImpl(this._dio);
  final Dio _dio;

  @override
  Future<Result<LedgerSummary>> summary({String? dateFrom, String? dateTo}) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>(
          '/reports/ledger',
          queryParameters: {'dateFrom': ?dateFrom, 'dateTo': ?dateTo},
        );
        return LedgerSummary.fromJson(res.data ?? const {});
      });

  @override
  Future<Result<Paginated<LedgerRow>>> rows(
    LedgerGroup group, {
    LedgerState? state,
    String? dateFrom,
    String? dateTo,
    int page = 1,
  }) =>
      guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>(
          '/reports/ledger/rows',
          queryParameters: {
            'group': group.wire,
            'state': ?state?.wire,
            'dateFrom': ?dateFrom,
            'dateTo': ?dateTo,
            'page': page,
            'pageSize': 30,
          },
        );
        return Paginated.fromJson(res.data ?? const <String, dynamic>{}, LedgerRow.fromJson);
      });
}
