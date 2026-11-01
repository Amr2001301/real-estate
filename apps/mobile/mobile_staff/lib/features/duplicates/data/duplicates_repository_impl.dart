import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../domain/duplicates.dart';

class DuplicatesRepositoryImpl implements DuplicatesRepository {
  DuplicatesRepositoryImpl(this._dio);
  final Dio _dio;

  @override
  Future<Result<List<DuplicateGroup>>> list() {
    return guardApiCall(() async {
      final res = await _dio.get<Map<String, dynamic>>('/leads/duplicates');
      return ((res.data?['groups'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DuplicateGroup.fromJson)
          .toList();
    });
  }

  @override
  Future<Result<int>> merge(String keepId, List<String> duplicateIds) {
    return guardApiCall(() async {
      final res = await _dio.post<Map<String, dynamic>>('/leads/$keepId/merge', data: {'duplicateIds': duplicateIds});
      return (res.data?['merged'] as num?)?.toInt() ?? duplicateIds.length;
    });
  }
}
