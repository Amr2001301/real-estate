// Wire shapes for the chat endpoints. Data layer only.

class ChatMessageDto {
  const ChatMessageDto({required this.id, required this.role, required this.content});
  final String id;
  final String role;
  final String content;

  factory ChatMessageDto.fromJson(Map<String, dynamic> json) => ChatMessageDto(
        id: json['id'] as String? ?? '',
        role: json['role'] as String? ?? 'ASSISTANT',
        content: json['content'] as String? ?? '',
      );
}

class ChatCardDto {
  const ChatCardDto({
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

  factory ChatCardDto.fromJson(Map<String, dynamic> json) => ChatCardDto(
        type: json['type'] as String? ?? 'project',
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        subtitle: json['subtitle'] as String?,
        price: json['price'] as String?,
        imageUrl: json['imageUrl'] as String?,
        href: json['href'] as String? ?? '',
      );
}

class ChatCtaDto {
  const ChatCtaDto({
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

  factory ChatCtaDto.fromJson(Map<String, dynamic> json) => ChatCtaDto(
        kind: json['kind'] as String? ?? 'link',
        label: json['label'] as String? ?? '',
        href: json['href'] as String?,
        action: json['action'] as String?,
        payloadMessage:
            (json['payload'] as Map<String, dynamic>?)?['message'] as String?,
      );
}

class AssistantOutputDto {
  const AssistantOutputDto({
    required this.message,
    required this.cards,
    required this.ctas,
    required this.quickReplies,
    required this.missingFields,
  });
  final ChatMessageDto message;
  final List<ChatCardDto> cards;
  final List<ChatCtaDto> ctas;
  final List<String> quickReplies;
  final List<String> missingFields;

  factory AssistantOutputDto.fromJson(Map<String, dynamic> json) => AssistantOutputDto(
        message: ChatMessageDto.fromJson(
            json['message'] as Map<String, dynamic>? ?? const {}),
        cards: (json['cards'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(ChatCardDto.fromJson)
            .toList(),
        ctas: (json['ctas'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(ChatCtaDto.fromJson)
            .toList(),
        quickReplies:
            (json['quickReplies'] as List? ?? []).whereType<String>().toList(),
        missingFields:
            (json['missingFields'] as List? ?? []).whereType<String>().toList(),
      );
}

class ChatSessionStartDto {
  const ChatSessionStartDto({
    required this.sessionId,
    required this.greeting,
    required this.quickReplies,
  });
  final String sessionId;
  final String greeting;
  final List<String> quickReplies;

  factory ChatSessionStartDto.fromJson(Map<String, dynamic> json) =>
      ChatSessionStartDto(
        sessionId: json['sessionId'] as String? ?? '',
        greeting: json['greeting'] as String? ?? '',
        quickReplies:
            (json['quickReplies'] as List? ?? []).whereType<String>().toList(),
      );
}

class RestoredSessionDto {
  const RestoredSessionDto({required this.sessionId, required this.messages});
  final String sessionId;
  final List<ChatMessageDto> messages;

  factory RestoredSessionDto.fromJson(Map<String, dynamic> json) => RestoredSessionDto(
        sessionId:
            (json['session'] as Map<String, dynamic>?)?['id'] as String? ?? '',
        messages: (json['messages'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(ChatMessageDto.fromJson)
            .toList(),
      );
}
