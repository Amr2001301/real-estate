import 'package:core/core_domain.dart';

/// Who sent a chat message.
enum ChatRole { user, assistant }

/// A chat message. Cards/CTAs/quickReplies are per-turn extras attached to the
/// latest assistant message for rendering. Pure-Dart domain entity.
class ChatMessage extends Equatable {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    this.cards = const [],
    this.ctas = const [],
    this.quickReplies = const [],
    this.missingFields = const [],
  });

  final String id;
  final ChatRole role;
  final String content;
  final List<ChatCard> cards;
  final List<ChatCta> ctas;
  final List<String> quickReplies;
  final List<String> missingFields;

  bool get isUser => role == ChatRole.user;

  ChatMessage copyWith({
    List<ChatCard>? cards,
    List<ChatCta>? ctas,
    List<String>? quickReplies,
    List<String>? missingFields,
  }) {
    return ChatMessage(
      id: id,
      role: role,
      content: content,
      cards: cards ?? this.cards,
      ctas: ctas ?? this.ctas,
      quickReplies: quickReplies ?? this.quickReplies,
      missingFields: missingFields ?? this.missingFields,
    );
  }

  @override
  List<Object?> get props =>
      [id, role, content, cards, ctas, quickReplies, missingFields];
}

/// A result card (unit/project); tapping opens [href].
class ChatCard extends Equatable {
  const ChatCard({
    required this.type,
    required this.id,
    required this.title,
    required this.href,
    this.subtitle,
    this.price,
    this.imageUrl,
  });

  final String type;
  final String id;
  final String title;
  final String? subtitle;
  final String? price;
  final String? imageUrl;
  final String href;

  @override
  List<Object?> get props => [type, id, title, href];
}

/// A call-to-action. `kind` is link | whatsapp | visit | info.
class ChatCta extends Equatable {
  const ChatCta({
    required this.kind,
    required this.label,
    this.href,
    this.action,
    this.payloadMessage,
  });

  final String kind;
  final String label;
  final String? href;
  final String? action;
  final String? payloadMessage;

  @override
  List<Object?> get props => [kind, label, href, action, payloadMessage];
}

/// The per-turn assistant reply.
class AssistantOutput extends Equatable {
  const AssistantOutput({
    required this.message,
    this.cards = const [],
    this.ctas = const [],
    this.quickReplies = const [],
    this.missingFields = const [],
  });

  final ChatMessage message;
  final List<ChatCard> cards;
  final List<ChatCta> ctas;
  final List<String> quickReplies;
  final List<String> missingFields;

  /// Folds the per-turn extras onto the assistant message for rendering.
  ChatMessage get enrichedMessage => message.copyWith(
        cards: cards,
        ctas: ctas,
        quickReplies: quickReplies,
        missingFields: missingFields,
      );

  @override
  List<Object?> get props => [message, cards, ctas, quickReplies, missingFields];
}

/// Result of starting a session (greeting + initial quick replies).
class ChatSessionStart extends Equatable {
  const ChatSessionStart({
    required this.sessionId,
    required this.greeting,
    required this.quickReplies,
  });

  final String sessionId;
  final String greeting;
  final List<String> quickReplies;

  @override
  List<Object?> get props => [sessionId, greeting, quickReplies];
}

/// Restored (text-only) session history.
class RestoredSession extends Equatable {
  const RestoredSession({required this.sessionId, required this.messages});

  final String sessionId;
  final List<ChatMessage> messages;

  @override
  List<Object?> get props => [sessionId, messages];
}
