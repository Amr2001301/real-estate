import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../domain/calendar_event.dart';

class CalendarRepositoryImpl implements CalendarRepository {
  CalendarRepositoryImpl(this._dio);
  final Dio _dio;

  @override
  Future<Result<List<CalendarEvent>>> events(DateTime from, DateTime to) {
    return guardApiCall(() async {
      final res = await _dio.get<Map<String, dynamic>>(
        '/leads/calendar',
        queryParameters: {'from': calendarDay(from), 'to': calendarDay(to)},
      );
      return ((res.data?['events'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(CalendarEvent.fromJson)
          .toList();
    });
  }
}
