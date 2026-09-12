import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../dtos/chat_dtos.dart';

/// Reads the selected company slug for chat tenant context.
typedef ChatSlugReader = Future<String?> Function();

/// Raw network access to the public chat endpoints. Owns the stable
/// `anonymousId` (persisted in secure storage). Returns DTOs; may throw.
///
/// Chat endpoints use @Public() on the backend. When [readTenantSlug] is
/// provided (K2 active), requests carry X-Tenant-Slug so the backend resolves
/// the correct company's chat configuration.
abstract interface class ChatRemoteDataSource {
  Future<ChatSessionStartDto> createSession(String locale);
  Future<AssistantOutputDto> sendMessage(String sessionId, String content);
  Future<RestoredSessionDto> restore(String sessionId);
  Future<void> sendFeedback(String sessionId, String messageId, bool positive);
}

class ChatRemoteDataSourceImpl implements ChatRemoteDataSource {
  ChatRemoteDataSourceImpl(this._dio, this._tokenStorage, {ChatSlugReader? readTenantSlug})
      : _readTenantSlug = readTenantSlug;

  final Dio _dio;
  final TokenStorage _tokenStorage;
  final ChatSlugReader? _readTenantSlug;

  static const _tenantHeader = 'X-Tenant-Slug';

  Future<Options> _publicOptions() async {
    final slug = await _readTenantSlug?.call();
    return Options(
      extra: const {AuthInterceptor.skipAuthExtra: true},
      headers: (slug != null && slug.isNotEmpty) ? {_tenantHeader: slug} : null,
    );
  }

  @override
  Future<ChatSessionStartDto> createSession(String locale) async {
    final anonymousId = await _tokenStorage.ensureAnonymousId();
    final res = await _dio.post<Map<String, dynamic>>(
      '/chat/sessions',
      data: {'anonymousId': anonymousId, 'source': 'MOBILE', 'locale': locale},
      options: await _publicOptions(),
    );
    return ChatSessionStartDto.fromJson(res.data!);
  }

  @override
  Future<AssistantOutputDto> sendMessage(String sessionId, String content) async {
    final anonymousId = await _tokenStorage.ensureAnonymousId();
    final res = await _dio.post<Map<String, dynamic>>(
      '/chat/sessions/$sessionId/messages',
      data: {'anonymousId': anonymousId, 'content': content},
      options: await _publicOptions(),
    );
    return AssistantOutputDto.fromJson(res.data!);
  }

  @override
  Future<RestoredSessionDto> restore(String sessionId) async {
    final anonymousId = await _tokenStorage.ensureAnonymousId();
    final res = await _dio.get<Map<String, dynamic>>(
      '/chat/sessions/$sessionId',
      queryParameters: {'anonymousId': anonymousId},
      options: await _publicOptions(),
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
      options: await _publicOptions(),
    );
  }
}
