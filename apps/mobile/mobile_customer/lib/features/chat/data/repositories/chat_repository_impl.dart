import 'package:core/core.dart';

import '../../domain/entities/chat_entities.dart';
import '../../domain/repositories/chat_repository.dart';
import '../datasources/chat_remote_data_source.dart';
import '../mappers/chat_mappers.dart';

/// Coordinates the chat remote data source + DTO→entity mapping, converting any
/// thrown error into an [AppFailure] via [guardApiCall].
class ChatRepositoryImpl implements ChatRepository {
  ChatRepositoryImpl(this._remote);

  final ChatRemoteDataSource _remote;

  @override
  Future<Result<ChatSessionStart>> createSession({required String locale}) {
    return guardApiCall(() async => (await _remote.createSession(locale)).toEntity());
  }

  @override
  Future<Result<AssistantOutput>> sendMessage({
    required String sessionId,
    required String content,
  }) {
    return guardApiCall(
      () async => (await _remote.sendMessage(sessionId, content)).toEntity(),
    );
  }

  @override
  Future<Result<RestoredSession>> restore(String sessionId) {
    return guardApiCall(() async => (await _remote.restore(sessionId)).toEntity());
  }

  @override
  Future<Result<void>> sendFeedback({
    required String sessionId,
    required String messageId,
    required bool positive,
  }) {
    return guardApiCall(
      () => _remote.sendFeedback(sessionId, messageId, positive),
    );
  }
}
