import 'package:core/core.dart';

import '../domain/entities/chat_entities.dart';

enum ChatStatus { initializing, ready, failed }

class ChatState extends Equatable {
  const ChatState({
    this.status = ChatStatus.initializing,
    this.sessionId,
    this.messages = const [],
    this.quickReplies = const [],
    this.sending = false,
    this.sessionFailure,
    this.sendError,
    this.retryContent,
  });

  /// Session-level lifecycle (creation).
  final ChatStatus status;
  final String? sessionId;
  final List<ChatMessage> messages;

  /// Quick replies from the latest assistant turn (or the greeting).
  final List<String> quickReplies;

  /// A message send is in flight (shows a typing indicator).
  final bool sending;

  /// Session creation failure → full-screen error + retry.
  final AppFailure? sessionFailure;

  /// Transient send failure → surfaced as a SnackBar by the screen.
  final AppFailure? sendError;

  /// The content to resend if the user taps retry.
  final String? retryContent;

  ChatState copyWith({
    ChatStatus? status,
    String? sessionId,
    List<ChatMessage>? messages,
    List<String>? quickReplies,
    bool? sending,
    AppFailure? sessionFailure,
    AppFailure? sendError,
    String? retryContent,
    bool clearSendError = false,
  }) {
    return ChatState(
      status: status ?? this.status,
      sessionId: sessionId ?? this.sessionId,
      messages: messages ?? this.messages,
      quickReplies: quickReplies ?? this.quickReplies,
      sending: sending ?? this.sending,
      sessionFailure: sessionFailure ?? this.sessionFailure,
      sendError: clearSendError ? null : (sendError ?? this.sendError),
      retryContent: retryContent ?? this.retryContent,
    );
  }

  @override
  List<Object?> get props => [
        status,
        sessionId,
        messages,
        quickReplies,
        sending,
        sessionFailure,
        sendError,
        retryContent,
      ];
}
