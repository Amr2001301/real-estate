import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../dtos/chat_dtos.dart';

/// Raw network access to the public chat endpoints. Owns the stable
/// `anonymousId` (persisted in secure storage). Returns DTOs; may throw.
abstract interface class ChatRemoteDataSource {
  Future<ChatSessionStartDto> createSession(String locale);
  Future<AssistantOutputDto> sendMessage(String sessionId, String content);
  Future<RestoredSessionDto> restore(String sessionId);
  Future<void> sendFeedback(String sessionId, String messageId, bool positive);
}

class ChatRemoteDataSourceImpl implements ChatRemoteDataSource {
  ChatRemoteDataSourceImpl(this._dio, this._tokenStorage);

  final Dio _dio;
  final TokenStorage _tokenStorage;
  static final Options _public =
      Options(extra: const {AuthInterceptor.skipAuthExtra: true});

  @override
  Future<ChatSessionStartDto> createSession(String locale) async {
    final anonymousId = await _tokenStorage.ensureAnonymousId();
    final res = await _dio.post<Map<String, dynamic>>(
      '/chat/sessions',
      data: {'anonymousId': anonymousId, 'source': 'MOBILE', 'locale': locale},
      options: _public,
    );
    return ChatSessionStartDto.fromJson(res.data!);
  }

  @override
  Future<AssistantOutputDto> sendMessage(String sessionId, String content) async {
    final anonymousId = await _tokenStorage.ensureAnonymousId();
    final res = await _dio.post<Map<String, dynamic>>(
      '/chat/sessions/$sessionId/messages',
      data: {'anonymousId': anonymousId, 'content': content},
      options: _public,
    );
    return AssistantOutputDto.fromJson(res.data!);
  }

  @override
  Future<RestoredSessionDto> restore(String sessionId) async {
    final anonymousId = await _tokenStorage.ensureAnonymousId();
    final res = await _dio.get<Map<String, dynamic>>(
      '/chat/sessions/$sessionId',
      queryParameters: {'anonymousId': anonymousId},
      options: _public,
    );
    return RestoredSessionDto.fromJson(res.data!);
  }

  @override
  Future<void> sendFeedback(String sessionId, String messageId, bool positive) async {
    final anonymousId = await _tokenStorage.ensureAnonymousId();
    await _dio.post<Map<String, dynamic>>(
      '/chat/sessions/$sessionId/feedback',
      data: {
        'anonymousId': anonymousId,
        'messageId': messageId,
        'rating': positive ? 'UP' : 'DOWN',
      },
      options: _public,
    );
  }
}
