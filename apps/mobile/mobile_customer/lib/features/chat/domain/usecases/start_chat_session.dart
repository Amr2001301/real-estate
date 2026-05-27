import 'package:core/core_domain.dart';

import '../entities/chat_entities.dart';
import '../repositories/chat_repository.dart';

/// Starts a chat session for the given locale.
class StartChatSession implements UseCase<ChatSessionStart, String> {
  const StartChatSession(this._repo);
  final ChatRepository _repo;

  @override
  Future<Result<ChatSessionStart>> call(String localeCode) =>
      _repo.createSession(locale: localeCode);
}
