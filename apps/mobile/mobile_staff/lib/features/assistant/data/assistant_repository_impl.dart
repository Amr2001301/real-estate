import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../domain/assistant.dart';

class AssistantRepositoryImpl implements AssistantRepository {
  AssistantRepositoryImpl(this._dio);
  final Dio _dio;

  @override
  Future<Result<AiStatus>> status() {
    return guardApiCall(() async {
      final res = await _dio.get<Map<String, dynamic>>('/ai/status');
      return AiStatus.fromJson(res.data ?? const {});
    });
  }

  @override
  Future<Result<AiAnswer>> ask(String message, List<AiTurn> history) {
    final recent = history.length > kAiHistoryTurns ? history.sublist(history.length - kAiHistoryTurns) : history;
    return guardApiCall(() async {
      final res = await _dio.post<Map<String, dynamic>>(
        '/ai/ask',
        data: {
          'message': message,
          'history': [for (final t in recent) t.toJson()],
        },
      );
      return AiAnswer.fromJson(res.data ?? const {});
    });
  }
}
