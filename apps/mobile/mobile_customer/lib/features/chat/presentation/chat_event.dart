import 'package:core/core.dart';

/// Chat is event-driven (multi-turn, side effects) → a Bloc, per the state
/// management guidance.
sealed class ChatEvent extends Equatable {
  const ChatEvent();
  @override
  List<Object?> get props => [];
}

/// Create (or recreate) the session and show the greeting.
class ChatStarted extends ChatEvent {
  const ChatStarted();
}

/// Send a user message (also used for quick-reply taps and retries).
class ChatMessageSent extends ChatEvent {
  const ChatMessageSent(this.content);
  final String content;
  @override
  List<Object?> get props => [content];
}
