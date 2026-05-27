import 'package:core/core_domain.dart';

import '../entities/chat_entities.dart';
import '../repositories/chat_repository.dart';

/// Restores a previous session's (text-only) history by id.
class RestoreChatSession implements UseCase<RestoredSession, String> {
  const RestoreChatSession(this._repo);
  final ChatRepository _repo;

  @override
  Future<Result<RestoredSession>> call(String sessionId) =>
      _repo.restore(sessionId);
}
