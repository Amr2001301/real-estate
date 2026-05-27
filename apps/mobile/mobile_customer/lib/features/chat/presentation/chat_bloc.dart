import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/chat_entities.dart';
import '../domain/usecases/send_chat_message.dart';
import '../domain/usecases/start_chat_session.dart';
import 'chat_event.dart';
import 'chat_state.dart';

/// Orchestrates the public assistant. Depends on use cases only — no
/// repository/Dio/DTOs.
class ChatBloc extends Bloc<ChatEvent, ChatState> {
  ChatBloc({
    required StartChatSession startSession,
    required SendChatMessage sendMessage,
    required String localeCode,
  })  : _startSession = startSession,
        _sendMessage = sendMessage,
        _locale = localeCode,
        super(const ChatState()) {
    on<ChatStarted>(_onStarted);
    on<ChatMessageSent>(_onMessageSent);
  }

  final StartChatSession _startSession;
  final SendChatMessage _sendMessage;
  final String _locale;

  Future<void> _onStarted(ChatStarted event, Emitter<ChatState> emit) async {
    emit(const ChatState(status: ChatStatus.initializing));
    final result = await _startSession(_locale);
    result.when(
      ok: (start) => emit(ChatState(
        status: ChatStatus.ready,
        sessionId: start.sessionId,
        quickReplies: start.quickReplies,
        messages: [
          ChatMessage(
            id: 'greeting',
            role: ChatRole.assistant,
            content: start.greeting,
          ),
        ],
      )),
      err: (failure) =>
          emit(ChatState(status: ChatStatus.failed, sessionFailure: failure)),
    );
  }

  Future<void> _onMessageSent(
    ChatMessageSent event,
    Emitter<ChatState> emit,
  ) async {
    final content = event.content.trim();
    final sessionId = state.sessionId;
    if (content.isEmpty || sessionId == null || state.sending) return;

    final userMsg = ChatMessage(
      id: 'u-${DateTime.now().microsecondsSinceEpoch}',
      role: ChatRole.user,
      content: content,
    );
    emit(state.copyWith(
      messages: [...state.messages, userMsg],
      quickReplies: const [],
      sending: true,
      clearSendError: true,
      retryContent: content,
    ));

    final result = await _sendMessage(
      SendChatMessageParams(sessionId: sessionId, content: content),
    );
    result.when(
      ok: (output) => emit(state.copyWith(
        messages: [...state.messages, output.enrichedMessage],
        quickReplies: output.quickReplies,
        sending: false,
      )),
      err: (failure) => emit(state.copyWith(sending: false, sendError: failure)),
    );
  }
}
