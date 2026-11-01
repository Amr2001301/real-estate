import 'package:core/core.dart';

/// AI2 in the staff app — the company's read-only assistant. The API keeps
/// no chat: each question goes with the earlier turns.

/// One turn of the chat: the rep's question or the assistant's answer.
class AiTurn extends Equatable {
  const AiTurn({required this.role, required this.content});
  const AiTurn.user(this.content) : role = 'user';
  const AiTurn.assistant(this.content) : role = 'assistant';

  /// 'user' or 'assistant'.
  final String role;
  final String content;

  bool get isUser => role == 'user';

  /// The API takes up to 8000 characters a turn.
  Map<String, dynamic> toJson() => {
    'role': role,
    'content': content.length > 8000 ? content.substring(0, 8000) : content,
  };

  @override
  List<Object?> get props => [role, content];
}

/// Whether questions can be asked, and if not why:
/// NOT_CONFIGURED (not on the platform), NOT_ACTIVE (no package for the
/// company, or it ended), EXHAUSTED (this month's questions are used).
class AiStatus extends Equatable {
  const AiStatus({required this.available, this.reason});

  factory AiStatus.fromJson(Map<String, dynamic> json) =>
      AiStatus(available: json['available'] == true, reason: json['reason'] as String?);

  final bool available;
  final String? reason;

  @override
  List<Object?> get props => [available, reason];
}

class AiAnswer extends Equatable {
  const AiAnswer({required this.answer, this.remaining});

  factory AiAnswer.fromJson(Map<String, dynamic> json) {
    final usage = json['usage'];
    final remaining = usage is Map ? usage['remaining'] : null;
    return AiAnswer(answer: (json['answer'] as String?) ?? '', remaining: remaining is num ? remaining.toInt() : null);
  }

  final String answer;

  /// Questions left this month for the company.
  final int? remaining;

  @override
  List<Object?> get props => [answer, remaining];
}

/// Earlier turns sent with each question (the API takes at most 20).
const kAiHistoryTurns = 20;

abstract interface class AssistantRepository {
  Future<Result<AiStatus>> status();
  Future<Result<AiAnswer>> ask(String message, List<AiTurn> history);
}
