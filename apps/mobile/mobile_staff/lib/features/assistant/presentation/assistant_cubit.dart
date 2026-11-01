import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/assistant.dart';

class AssistantState extends Equatable {
  const AssistantState({this.status, this.turns = const [], this.pending = false, this.error, this.draft});

  /// Null until read (and when reading it failed: asking is still offered,
  /// the API answers for itself).
  final AiStatus? status;
  final List<AiTurn> turns;

  /// A question is out.
  final bool pending;

  /// Why the last question was not answered: an API code (AI_QUOTA_EXHAUSTED,
  /// AI_NOT_ACTIVE, AI_NOT_CONFIGURED, AI_UNAVAILABLE), RATE, or a failure.
  final AssistantError? error;

  /// A question handed back to the box after it failed.
  final String? draft;

  bool get canAsk => !pending && status?.available != false;

  /// Why questions can't be asked at all, when the API says so.
  String? get blockedReason => status != null && !status!.available ? status!.reason : null;

  AssistantState copyWith({
    AiStatus? status,
    List<AiTurn>? turns,
    bool? pending,
    AssistantError? error,
    bool clearError = false,
    String? draft,
    bool clearDraft = false,
  }) => AssistantState(
    status: status ?? this.status,
    turns: turns ?? this.turns,
    pending: pending ?? this.pending,
    error: clearError ? null : (error ?? this.error),
    draft: clearDraft ? null : (draft ?? this.draft),
  );

  @override
  List<Object?> get props => [status, turns, pending, error, draft];
}

class AssistantError extends Equatable {
  const AssistantError({this.code, this.failure});
  final String? code;
  final AppFailure? failure;

  @override
  List<Object?> get props => [code, failure];
}

/// The chat with the assistant. Kept while the screen is open; «محادثة
/// جديدة» starts over.
class AssistantCubit extends Cubit<AssistantState> {
  AssistantCubit(this._repo) : super(const AssistantState());
  final AssistantRepository _repo;

  Future<void> load() async {
    final result = await _repo.status();
    final s = result.dataOrNull;
    if (s != null) emit(state.copyWith(status: s));
  }

  Future<void> ask(String question) async {
    final message = question.trim();
    if (message.isEmpty || !state.canAsk) return;
    final history = state.turns;
    emit(state.copyWith(turns: [...history, AiTurn.user(message)], pending: true, clearError: true, clearDraft: true));
    final result = await _repo.ask(message, history);
    result.when(
      ok: (a) => emit(
        state.copyWith(
          turns: [...state.turns, AiTurn.assistant(a.answer)],
          pending: false,
          status: a.remaining != null && a.remaining! <= 0
              ? const AiStatus(available: false, reason: 'EXHAUSTED')
              : null,
        ),
      ),
      err: (f) {
        final code = f.statusCode == 429 ? 'RATE' : f.code;
        // Not answered: take the question back off the chat, into the box.
        final turns = state.turns.isNotEmpty && state.turns.last == AiTurn.user(message)
            ? state.turns.sublist(0, state.turns.length - 1)
            : state.turns;
        emit(
          state.copyWith(
            turns: turns,
            pending: false,
            error: AssistantError(code: code, failure: f),
            draft: message,
            status: switch (code) {
              'AI_QUOTA_EXHAUSTED' => const AiStatus(available: false, reason: 'EXHAUSTED'),
              'AI_NOT_ACTIVE' => const AiStatus(available: false, reason: 'NOT_ACTIVE'),
              'AI_NOT_CONFIGURED' => const AiStatus(available: false, reason: 'NOT_CONFIGURED'),
              _ => null,
            },
          ),
        );
      },
    );
  }

  void clear() {
    if (state.pending) return;
    emit(state.copyWith(turns: const [], clearError: true, clearDraft: true));
  }
}
