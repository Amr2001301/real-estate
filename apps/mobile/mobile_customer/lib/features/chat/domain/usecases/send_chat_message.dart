import 'package:core/core_domain.dart';

import '../entities/chat_entities.dart';
import '../repositories/chat_repository.dart';

class SendChatMessageParams {
  const SendChatMessageParams({required this.sessionId, required this.content});
  final String sessionId;
  final String content;
}

/// Sends a user message and returns the assistant's reply.
class SendChatMessage implements UseCase<AssistantOutput, SendChatMessageParams> {
  const SendChatMessage(this._repo);
  final ChatRepository _repo;

  @override
  Future<Result<AssistantOutput>> call(SendChatMessageParams params) =>
      _repo.sendMessage(sessionId: params.sessionId, content: params.content);
}
