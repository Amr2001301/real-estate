import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../domain/cheque.dart';

class ChequesRepositoryImpl implements ChequesRepository {
  ChequesRepositoryImpl(this._dio);
  final Dio _dio;

  @override
  Future<Result<Paginated<Cheque>>> list({String? status, String? q, int page = 1}) {
    return guardApiCall(() async {
      final res = await _dio.get<Map<String, dynamic>>(
        '/payment-instruments',
        queryParameters: {
          'type': 'CHEQUE',
          'status': ?status,
          'q': ?(q?.trim().isNotEmpty == true ? q!.trim() : null),
          'page': page,
          'pageSize': 20,
        },
      );
      return Paginated.fromJson(res.data ?? const <String, dynamic>{}, Cheque.fromJson);
    });
  }

  @override
  Future<Result<void>> deposit(String id) => guardApiCall(() async {
        await _dio.post<Map<String, dynamic>>('/payment-instruments/$id/deposit');
      });

  @override
  Future<Result<void>> clear(String id, {DateTime? clearingDate}) => guardApiCall(() async {
        await _dio.post<Map<String, dynamic>>(
          '/payment-instruments/$id/clear',
          data: {
            if (clearingDate != null) 'clearingDate': calendarDayOf(clearingDate),
          },
        );
      });

  @override
  Future<Result<Cheque>> get(String id) {
    return guardApiCall(() async {
      final res = await _dio.get<Map<String, dynamic>>('/payment-instruments/$id');
      return Cheque.fromJson(res.data ?? const {});
    });
  }
}

/// The day as the API takes a date: YYYY-MM-DD.
String calendarDayOf(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
