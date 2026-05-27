import 'package:core/core_domain.dart';

import '../entities/chat_entities.dart';

/// Domain contract for the public chat assistant. Returns [Result] with
/// [AppFailure]; pure Dart.
abstract interface class ChatRepository {
  Future<Result<ChatSessionStart>> createSession({required String locale});

  Future<Result<AssistantOutput>> sendMessage({
    required String sessionId,
    required String content,
  });

  Future<Result<RestoredSession>> restore(String sessionId);

  Future<Result<void>> sendFeedback({
    required String sessionId,
    required String messageId,
    required bool positive,
  });
}
